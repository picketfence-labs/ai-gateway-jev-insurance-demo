#!/usr/bin/env python3
"""One explicitly approved synthetic native Jev POST through the dedicated DP.

No automatic retries. Running this file is not permission for another paid call.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import stat
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
URL = "http://127.0.0.1:8000/jev/v1/systemone"
BODY = {
    "model": "insurance-jev-decisions",
    "state": "Synthetic signal: green.",
    "questions": {"signal_class": {
        "type": "choice",
        "instructions": "Classify the synthetic signal. Choose green only when the state explicitly says green; otherwise choose other.",
        "criteria": {"green": "The state explicitly signals green.",
                     "other": "The state does not explicitly signal green."},
    }},
}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def run():
    result = {"attempts_reserved": 0, "delivery": "not_attempted"}
    try:
        spec = importlib.util.spec_from_file_location("diagnostic", ROOT / "scripts/konnect-diagnostic.py")
        diagnostic = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(diagnostic)
        secrets = diagnostic.known_secret_values()
        with open(ROOT / ".env.live.local", "r", opener=lambda p, flags: os.open(p, flags | os.O_NOFOLLOW)) as file:
            if stat.S_IMODE(os.fstat(file.fileno()).st_mode) != 0o600:
                raise ValueError("Secret file permissions")
            text = file.read(65536)
        if len(text) == 65536:
            raise ValueError("Secret file size")
        env = dict(line.split("=", 1) for line in text.splitlines()
                   if "=" in line and not line.lstrip().startswith("#"))
        key = env.get("AI_GATEWAY_JEV_API_KEY", "").strip().strip("\"'")
        if not key or key not in secrets:
            raise ValueError("Missing inbound Jev key")
    except Exception:
        return {**result, "ok": False, "category": "preflight_failed"}
    data = json.dumps(BODY, separators=(",", ":")).encode()
    result["payload_sha256"] = hashlib.sha256(data).hexdigest()
    request = urllib.request.Request(URL, data=data, method="POST",
                                     headers={"Content-Type": "application/json", "apikey": key})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    result.update(attempts_reserved=1, delivery="unknown")
    try:
        with opener.open(request, timeout=10) as response:
            result.update(http_status=response.status, delivery="http_response_received")
            raw = response.read(65537)
        if len(raw) > 65536:
            return {**result, "ok": False, "category": "response_size_limit"}
        try:
            parsed = json.loads(raw)
        except (ValueError, UnicodeError):
            return {**result, "ok": False, "category": "response_json_invalid"}
        if not isinstance(parsed, dict) or not isinstance(parsed.get("answers"), dict):
            return {**result, "ok": False, "category": "response_contract_mismatch"}
        answer = parsed["answers"].get("signal_class", {})
        if not isinstance(answer, dict):
            return {**result, "ok": False, "category": "response_contract_mismatch"}
        choice = answer.get("choice")
        if answer.get("type") != "choice" or not isinstance(choice, str) or choice not in {"green", "other"}:
            return {**result, "ok": False, "category": "response_contract_mismatch"}
        model = parsed.get("model")
        model_safe = (isinstance(model, str) and len(model) <= 64
                      and (model == "jev-latest" or re.fullmatch(r"jev-[0-9][A-Za-z0-9._-]{0,59}", model))
                      and not any(secret in model for secret in secrets if secret))
        result.update(ok=True, choice=choice, actual_model=model if model_safe else "unrecognized")
        if not model_safe:
            result["model_projection_reason"] = "identifier_not_allowlisted_or_sensitive"
        numeric = lambda value: isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1
        if numeric(answer.get("confidence")):
            result["confidence"] = answer["confidence"]
        probabilities = answer.get("probabilities")
        if isinstance(probabilities, dict) and set(probabilities) == {"green", "other"} and all(numeric(value) for value in probabilities.values()):
            result["probabilities"] = probabilities
        usage = parsed.get("usage", {})
        if not isinstance(usage, dict):
            usage = {}
        result["usage"] = {name: value for name in ("input_tokens", "output_tokens")
                           if isinstance((value := usage.get(name)), int) and not isinstance(value, bool) and value >= 0}
        return result
    except Exception as error:
        return {**result, **diagnostic.classify(error, secrets=secrets)}

if __name__ == "__main__":
    print(json.dumps(run(), sort_keys=True))
