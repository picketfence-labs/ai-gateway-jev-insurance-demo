#!/usr/bin/env python3
"""Bounded, redacted diagnostics for this demo's models endpoint. No CLI POST.

Additional POSTs remain paused. Importing request_models with allow_post=True
is only a mechanical guard, not permission; a new owner decision is required.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import base64
import re
import socket
import ssl
import stat
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
import urllib.parse

URL = "https://us.api.konghq.com/v1/ai-gateways/3754a93c-fba3-4b95-adbb-b429816b431c/models"
BODY_HASH = "3289cbdf27568d9db9e15c6cee7081e9f9d304ca42332097dd959bd9e000e791"
FIELDS = {"name", "type", "capabilities", "capabilities.0", "formats.0.type",
          "targets.0.provider", "targets.0.config.type", "access.auth_strategies.0",
          "config.balancer.algorithm", "config.balancer.retries",
          "config.balancer.failover_criteria", "config.route.paths", "config.logging.payloads"}
CODES = {"VALIDATION_ERROR", "INVALID_ARGUMENT", "INVALID_REQUEST", "BAD_REQUEST",
         "SCHEMA_VALIDATION_FAILED", "UNAUTHORIZED", "FORBIDDEN", "CONFLICT",
         "bad-request", "unauthorized", "forbidden", "not-found", "conflict", "internal"}
CONTAINERS = {"error", "errors", "details", "detail", "fields"}
EXPLANATIONS = {"message", "title", "detail", "error"}


def known_secret_values():
    """Local secrets are read only to redact; never returned as evidence."""
    sensitive = re.compile(r"authorization|api.?key|token|password|secret|credential", re.I)
    values = {v for k, v in os.environ.items() if v and sensitive.search(k)}
    root = Path(__file__).resolve().parent.parent
    for name in (".env.live.local", ".env.upstream-handoff.local"):
        path = root / name
        try:
            with open(path, "r", opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW)) as file:
                if stat.S_IMODE(os.fstat(file.fileno()).st_mode) != 0o600:
                    raise ValueError("Secret redaction file permissions")
                text = file.read(65536)
            if len(text) == 65536:
                raise ValueError("Secret redaction file too large")
            if name.endswith("handoff.local"):
                entries = json.loads(text)
            else:
                entries = dict(line.split("=", 1) for line in text.splitlines()
                               if "=" in line and not line.lstrip().startswith("#"))
            values.update(v.strip().strip("\"'") for k, v in entries.items()
                          if isinstance(v, str) and v.strip() and sensitive.search(k))
        except FileNotFoundError:
            pass
    return values


def safe_explanations(parsed, secrets):
    """Bounded known envelopes; preserve explanations, not raw JSON values."""
    variants = set()
    for secret in secrets:
        if secret:
            quoted = (urllib.parse.quote(secret, safe=""), urllib.parse.quote_plus(secret))
            encoded = (base64.b64encode(secret.encode()).decode(),
                       base64.urlsafe_b64encode(secret.encode()).decode())
            variants.update((secret, json.dumps(secret)[1:-1], *quoted, *encoded))
            variants.update(re.sub(r"%[0-9A-F]{2}", lambda m: m[0].lower(), q) for q in quoted)
            variants.update(value.rstrip("=") for value in encoded)

    def redact(text):
        for value in sorted(variants, key=len, reverse=True):
            text = text.replace(value, "[REDACTED]")
        text = re.sub(r"(?i)\bBearer\s+[^\s,;\"']+", "Bearer [REDACTED]", text)
        text = re.sub(r"(?i)\b(authorization|api[_-]?key|token|password|secret)\s*[:=]\s*(?:\"[^\"]*\"|'[^']*'|[^\s,;]+)",
                      r"\1=[REDACTED]", text)
        text = re.sub(r"[\x00-\x1f\x7f]", " ", text)
        return text[:512]

    evidence = {"explanations": [], "shape": [], "fields": []}
    def walk(node, path="root", depth=0):
        if depth > 4 or len(evidence["shape"]) >= 24:
            return
        if isinstance(node, dict):
            unknown = 0
            for key, value in list(node.items())[:32]:
                # Sensitive values are never traversed or exposed, even if nested.
                if re.search(r"authorization|api.?key|token|password|secret|credential", str(key), re.I):
                    continue
                if key in FIELDS:
                    evidence["fields"].append(key)
                if key in EXPLANATIONS and isinstance(value, str) and len(evidence["explanations"]) < 4:
                    evidence["explanations"].append({"path": path + "." + key, "text": redact(value)})
                elif key in CONTAINERS:
                    kind = "object" if isinstance(value, dict) else "array" if isinstance(value, list) else "other"
                    evidence["shape"].append({"path": path + "." + key, "type": kind})
                    walk(value, path + "." + key, depth + 1)
                else:
                    unknown += 1
            if unknown:
                evidence["shape"].append({"path": path, "unknown_keys": unknown})
        elif isinstance(node, list):
            for value in node[:4]:
                walk(value, path + "[]", depth + 1)
    walk(parsed)
    evidence["fields"] = sorted(set(evidence["fields"]))
    return evidence


def payload_bytes():
    body = json.loads((Path(__file__).resolve().parent.parent /
                       "config/konnect-ai-gateway/model-jev-typesafe.json").read_text())
    body["enabled"] = True
    body["access"]["auth_strategies"] = ["insurance-demo-live-key-auth"]
    body["targets"][0]["provider"] = "insurance-demo-typesafe-live"
    data = json.dumps(body, separators=(",", ":")).encode()
    if hashlib.sha256(data).hexdigest() != BODY_HASH:
        raise ValueError("Payload review required")
    return data


def classify(error, secrets=None):
    """No raw exception/headers/body; only bounded redacted explanations."""
    result = {"ok": False, "exception_type": "UnexpectedError",
              "category": "unclassified_error", "delivery": "unknown"}
    if isinstance(error, urllib.error.HTTPError):
        result.update(exception_type="HTTPError", category="http_error",
                      delivery="http_response_received", http_status=error.code)
        if 300 <= error.code < 400:
            result["category"] = "redirect_refused"
        try:
            parsed = json.loads(error.read(65536))
            try:
                result.update(safe_explanations(parsed, known_secret_values() if secrets is None else secrets))
            except Exception:
                result["message_redaction"] = "unavailable"
            if isinstance(parsed, dict):
                code = parsed.get("code")
                if isinstance(code, str) and code in CODES:
                    result["code"] = code
                fields = parsed.get("fields", {})
                if isinstance(fields, dict):
                    result["fields"] = sorted(set(result.get("fields", [])) | (set(fields) & FIELDS))
                # Messages become fixed categories, never copied or persisted.
                message = parsed.get("message")
                if isinstance(message, str):
                    text = message.lower()
                    if "required" in text:
                        result["category"] = "required_field_validation"
                    elif "enum" in text or "not allowed" in text:
                        result["category"] = "enum_validation"
                    elif "validation" in text:
                        result["category"] = "validation_error"
        except Exception:
            result["body_classification"] = "unavailable"
        finally:
            # HTTPError owns the response stream; closing prevents an implicit
            # cleanup warning from serializing its potentially secret message.
            try:
                error.close()
            except Exception:
                pass
    elif isinstance(error, (urllib.error.URLError, OSError)):
        result["exception_type"] = "URLError" if isinstance(error, urllib.error.URLError) else "OSError"
        reason = error.reason if isinstance(error, urllib.error.URLError) else error
        if isinstance(reason, ssl.SSLCertVerificationError):
            result.update(reason_type="SSLCertVerificationError", category="tls_verification_failed",
                          delivery="pre_http_tls_failure")
            if type(getattr(reason, "verify_code", None)) is int:
                result["verify_code"] = reason.verify_code
        elif isinstance(reason, socket.gaierror):
            result.update(reason_type="gaierror", category="dns_failed", delivery="pre_http_dns_failure")
        elif isinstance(reason, ConnectionRefusedError):
            result.update(reason_type="ConnectionRefusedError", category="connection_refused",
                          delivery="pre_http_connect_failure")
        elif isinstance(reason, TimeoutError):
            result.update(reason_type="TimeoutError", category="timeout")
        else:
            result.update(reason_type="unclassified_reason", category="transport_error")
        if type(getattr(reason, "errno", None)) is int:
            result["errno"] = reason.errno
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_models(method="GET", *, allow_post=False, opener=None):
    if method not in {"GET", "POST"} or (method == "POST" and not allow_post):
        return {"ok": False, "category": "post_paused"}
    token = os.environ.get("KONNECT_TOKEN")
    if not token:
        return {"ok": False, "category": "missing_authentication"}
    # Load redaction inputs once, before any HTTP; never re-read them afterwards.
    try:
        secrets = known_secret_values()
    except Exception as error:
        kind = type(error).__name__
        return {"ok": False, "category": "redaction_preflight_failed", "method": method,
                "delivery": "not_attempted",
                "exception_type": kind if kind in {"TypeError", "ValueError", "OSError", "PermissionError", "JSONDecodeError"} else "UnexpectedError"}
    try:
        data = payload_bytes() if method == "POST" else None
        context = ssl.create_default_context()  # OS/default roots, never bypassed.
        assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
        if opener is None:
            opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), NoRedirect())
        request = urllib.request.Request(URL, data=data, method=method,
                                        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with opener.open(request, timeout=30) as response:
            parsed = json.loads(response.read(65536))
            rows = parsed.get("data", []) if isinstance(parsed, dict) else parsed
            names = sorted({row.get("name") for row in rows if isinstance(row, dict)
                            and row.get("name") in {"insurance-normal", "insurance-jev-decisions"}}) if isinstance(rows, list) else []
            result = {"ok": True, "http_status": response.status, "model_names": names}
    except Exception as error:
        result = classify(error, secrets=secrets)
    result.update(method=method, request_body_sha256=BODY_HASH if method == "POST" else None)
    return result


class DiagnosticTests(unittest.TestCase):
    def test_http400_canary(self):
        error = urllib.error.HTTPError(URL, 400, "CANARY-SECRET", {"Authorization": "CANARY-SECRET"},
            io.BytesIO(json.dumps({"code": "VALIDATION_ERROR", "message": "required CANARY-SECRET",
                                  "fields": {"config.balancer.algorithm": "CANARY-SECRET", "CANARY-SECRET": "x"}}).encode()))
        with patch.dict(os.environ, {"DIAGNOSTIC_TEST_TOKEN": "CANARY-SECRET"}):
            result = classify(error)
        self.assertEqual(result["fields"], ["config.balancer.algorithm"])
        self.assertEqual(result["category"], "required_field_validation")
        self.assertEqual(result["explanations"][0]["text"], "required [REDACTED]")
        self.assertNotIn("CANARY-SECRET", json.dumps(result))
        generic = classify(urllib.error.HTTPError(URL, 400, "CANARY-SECRET", None,
                           io.BytesIO(b'{"code":"bad-request"}')))
        self.assertEqual(generic["code"], "bad-request")

    def test_transport_and_oserror(self):
        cases = [(urllib.error.URLError(ssl.SSLCertVerificationError(1, "CANARY-SECRET")), "pre_http_tls_failure"),
                 (urllib.error.URLError(TimeoutError("CANARY-SECRET")), "unknown"),
                 (ConnectionRefusedError(61, "CANARY-SECRET"), "pre_http_connect_failure"),
                 (urllib.error.URLError("https://token-CANARY-SECRET.invalid"), "unknown")]
        for error, delivery in cases:
            result = classify(error)
            self.assertEqual(result["delivery"], delivery)
            self.assertNotIn("CANARY-SECRET", json.dumps(result))

    def test_invalid_body_and_untrusted_code(self):
        for data in (b"CANARY-SECRET", b'{"code":"CANARY-SECRET","message":"CANARY-SECRET"}'):
            with patch.dict(os.environ, {"DIAGNOSTIC_TEST_TOKEN": "CANARY-SECRET"}):
                result = classify(urllib.error.HTTPError(URL, 400, "CANARY-SECRET", None, io.BytesIO(data)))
            self.assertEqual(result["http_status"], 400)
            self.assertNotIn("CANARY-SECRET", json.dumps(result))

    def test_nested_explanations_encoded_secrets_and_unknown_shape(self):
        secret = "CANARY-secret+/=\""
        messages = ["Invalid field config.balancer.algorithm; expected round-robin " + secret,
                    "Missing algorithm " + urllib.parse.quote(secret, safe=""),
                    "Unsupported value " + base64.b64encode(secret.encode()).decode()]
        body = {"code": "UNREVIEWED-CODE", "errors": [
            {"message": messages[0], "password": {"message": secret},
             "fields": {"config.balancer.algorithm": secret}},
            {"detail": messages[1], "authorization": secret},
            {"error": {"title": messages[2], "token": secret}}],
            "unknown-container": {"message": secret}}
        result = classify(urllib.error.HTTPError(URL, 400, "CANARY-SECRET", None,
                          io.BytesIO(json.dumps(body).encode())), secrets={secret})
        output = json.dumps(result)
        self.assertNotIn("CANARY", output)
        self.assertNotIn("UNREVIEWED-CODE", output)
        self.assertNotIn("unknown-container", output)
        self.assertIn("config.balancer.algorithm", result["fields"])
        self.assertIn("expected round-robin", result["explanations"][0]["text"])
        self.assertEqual(len(result["explanations"]), 3)
        forms = [secret, json.dumps(secret)[1:-1], urllib.parse.quote(secret, safe=""),
                 re.sub(r"%[0-9A-F]{2}", lambda m: m[0].lower(), urllib.parse.quote(secret, safe="")),
                 base64.b64encode(secret.encode()).decode(),
                 base64.urlsafe_b64encode(secret.encode()).decode().rstrip("=")]
        redacted = safe_explanations({"message": "Invalid field; " + " ".join(forms)}, {secret})
        for form in forms:
            self.assertNotIn(form, json.dumps(redacted))
        limited = safe_explanations({"message": "a" * 2000, "details": [{"message": "b"}] * 50}, set())
        self.assertLessEqual(len(limited["explanations"]), 4)
        self.assertLessEqual(len(limited["explanations"][0]["text"]), 512)

    def test_success_get_tls_and_no_redirect(self):
        class Response(io.BytesIO):
            status = 200
        class Opener:
            def open(self, request, timeout):
                assert request.get_method() == "GET" and timeout == 30
                return Response(b'{"data":[{"name":"insurance-normal"}]}')
        def factory(*handlers):
            https = next(h for h in handlers if isinstance(h, urllib.request.HTTPSHandler))
            self.assertEqual(https._context.verify_mode, ssl.CERT_REQUIRED)
            self.assertTrue(https._context.check_hostname)
            redirect = next(h for h in handlers if isinstance(h, NoRedirect))
            self.assertIsNone(redirect.redirect_request(None, None, 302, None, None, "https://elsewhere.invalid"))
            return Opener()
        with patch.dict(os.environ, {"KONNECT_TOKEN": "CANARY-SECRET"}), patch("urllib.request.build_opener", factory):
            result = request_models()
        self.assertEqual(result["model_names"], ["insurance-normal"])
        self.assertNotIn("CANARY-SECRET", json.dumps(result))
        self.assertEqual(request_models("POST")["category"], "post_paused")
        self.assertEqual(hashlib.sha256(payload_bytes()).hexdigest(), BODY_HASH)

    def test_string_error_explanation(self):
        body = b'{"error":"missing targets.0.provider value CANARY-SECRET"}'
        result = classify(urllib.error.HTTPError(URL, 400, "CANARY-SECRET", None,
                          io.BytesIO(body)), secrets={"CANARY-SECRET"})
        self.assertEqual(result["explanations"][0]["text"], "missing targets.0.provider value [REDACTED]")
        self.assertNotIn("CANARY-SECRET", json.dumps(result))

    def test_real_files_post_error_and_preflight_failure(self):
        template = (Path(__file__).resolve().parent.parent /
                    "config/konnect-ai-gateway/model-jev-typesafe.json").read_text()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config/konnect-ai-gateway").mkdir(parents=True)
            (root / "config/konnect-ai-gateway/model-jev-typesafe.json").write_text(template)
            live = root / ".env.live.local"
            live.write_text("AI_GATEWAY_API_KEY=DUMMY-INBOUND-CANARY\n")
            handoff = root / ".env.upstream-handoff.local"
            handoff.write_text('{"JEV_API_KEY":"DUMMY-UPSTREAM-CANARY"}')
            live.chmod(0o600)
            handoff.chmod(0o600)
            class Opener:
                calls = 0
                def open(self, request, timeout):
                    self.calls += 1
                    assert request.get_method() == "POST"
                    body = {"error": {"message": "Invalid field config.balancer.algorithm DUMMY-TOKEN-CANARY DUMMY-INBOUND-CANARY DUMMY-UPSTREAM-CANARY"}}
                    raise urllib.error.HTTPError(URL, 400, "unused", None, io.BytesIO(json.dumps(body).encode()))
            opener = Opener()
            with patch.dict(globals(), {"__file__": str(root / "scripts/konnect-diagnostic.py")}), \
                 patch.dict(os.environ, {"KONNECT_TOKEN": "DUMMY-TOKEN-CANARY"}, clear=True):
                result = request_models("POST", allow_post=True, opener=opener)
                self.assertEqual(opener.calls, 1)
                self.assertEqual(result["http_status"], 400)
                self.assertNotIn("message_redaction", result)
                self.assertIn("Invalid field config.balancer.algorithm", result["explanations"][0]["text"])
                self.assertNotIn("CANARY", json.dumps(result))
                # Same actual loader, unsafe file mode: HTTP opener must not run.
                live.chmod(0o644)
                opener.calls = 0
                result = request_models("POST", allow_post=True, opener=opener)
                self.assertEqual(result["category"], "redaction_preflight_failed")
                self.assertEqual(result["delivery"], "not_attempted")
                self.assertEqual(opener.calls, 0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--self-test", action="store_true")
    modes.add_argument("--get-models", action="store_true", help="read-only; no CLI POST exists")
    modes.add_argument("--describe-payload", action="store_true", help="reviewed secret-free structure/hash")
    args = parser.parse_args()
    if args.self_test:
        unittest.main(argv=[__file__])
    elif args.get_models:
        print(json.dumps(request_models(), sort_keys=True))
    else:
        print(json.dumps({"request_body_sha256": BODY_HASH, "body": json.loads(payload_bytes())}, sort_keys=True))
