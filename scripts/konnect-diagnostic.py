#!/usr/bin/env python3
"""Bounded, secret-free diagnostics for this demo's models endpoint. No CLI POST.

Additional POSTs remain paused. Importing request_models with allow_post=True
is only a mechanical guard, not permission; a new owner decision is required.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import socket
import ssl
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

URL = "https://us.api.konghq.com/v1/ai-gateways/3754a93c-fba3-4b95-adbb-b429816b431c/models"
BODY_HASH = "3289cbdf27568d9db9e15c6cee7081e9f9d304ca42332097dd959bd9e000e791"
FIELDS = {"name", "type", "capabilities", "capabilities.0", "formats.0.type",
          "targets.0.provider", "targets.0.config.type", "access.auth_strategies.0",
          "config.balancer.algorithm", "config.balancer.retries",
          "config.balancer.failover_criteria", "config.route.paths", "config.logging.payloads"}
CODES = {"VALIDATION_ERROR", "INVALID_ARGUMENT", "INVALID_REQUEST", "BAD_REQUEST",
         "SCHEMA_VALIDATION_FAILED", "UNAUTHORIZED", "FORBIDDEN", "CONFLICT",
         "bad-request", "unauthorized", "forbidden", "not-found", "conflict", "internal"}


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


def classify(error):
    """Never serialize exception strings, headers, bodies or arbitrary values."""
    result = {"ok": False, "exception_type": "UnexpectedError",
              "category": "unclassified_error", "delivery": "unknown"}
    if isinstance(error, urllib.error.HTTPError):
        result.update(exception_type="HTTPError", category="http_error",
                      delivery="http_response_received", http_status=error.code)
        if 300 <= error.code < 400:
            result["category"] = "redirect_refused"
        try:
            parsed = json.loads(error.read(65536))
            if isinstance(parsed, dict):
                code = parsed.get("code")
                if isinstance(code, str) and code in CODES:
                    result["code"] = code
                fields = parsed.get("fields", {})
                if isinstance(fields, dict):
                    result["fields"] = sorted(set(fields) & FIELDS)
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
        result = classify(error)
    result.update(method=method, request_body_sha256=BODY_HASH if method == "POST" else None)
    return result


class DiagnosticTests(unittest.TestCase):
    def test_http400_canary(self):
        error = urllib.error.HTTPError(URL, 400, "CANARY-SECRET", {"Authorization": "CANARY-SECRET"},
            io.BytesIO(json.dumps({"code": "VALIDATION_ERROR", "message": "required CANARY-SECRET",
                                  "fields": {"config.balancer.algorithm": "CANARY-SECRET", "CANARY-SECRET": "x"}}).encode()))
        result = classify(error)
        self.assertEqual(result["fields"], ["config.balancer.algorithm"])
        self.assertEqual(result["category"], "required_field_validation")
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
            result = classify(urllib.error.HTTPError(URL, 400, "CANARY-SECRET", None, io.BytesIO(data)))
            self.assertEqual(result["http_status"], 400)
            self.assertNotIn("CANARY-SECRET", json.dumps(result))

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
