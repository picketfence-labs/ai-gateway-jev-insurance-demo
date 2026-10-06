#!/usr/bin/env python3
"""Bounded helper for the five reviewed insurance AI MCP Server entities.

Default is no-network static preflight. --create-reviewed-mcp5 is deliberately
explicit, uses only the fixed US AI Gateway endpoint/targets below, refuses
name collisions, and stops at the first failure. It never prints response
bodies, headers, tokens, or exception text.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AI_GATEWAY_ID = "3754a93c-fba3-4b95-adbb-b429816b431c"
BASE_URL = f"https://us.api.konghq.com/v1/ai-gateways/{AI_GATEWAY_ID}"
MCP_URL = f"{BASE_URL}/mcp-servers"
MODELS_URL = f"{BASE_URL}/models"
LIVE_MCP_AUTH = "insurance-demo-live-key-auth"
LIVE_MCP_CONSUMER = "insurance-demo-local-app"
EXPECTED = (
    ("product", "mcp-product.json", "insurance-demo-product-mcp",
     "http://product-api:8000", "/mcp/product", "get_product_products__product_id__get",
     "/mcp/product/products/{product_id}"),
    ("customer", "mcp-customer.json", "insurance-demo-customer-mcp",
     "http://customer-api:8000", "/mcp/customer", "get_customer_customers__customer_id__get",
     "/mcp/customer/customers/{customer_id}"),
    ("application", "mcp-application.json", "insurance-demo-application-mcp",
     "http://application-api:8000", "/mcp/application", "get_application_applications__application_id__get",
     "/mcp/application/applications/{application_id}"),
    ("policy", "mcp-policy.json", "insurance-demo-policy-mcp",
     "http://policy-api:8000", "/mcp/policy", "get_policy_policies__policy_id__get",
     "/mcp/policy/policies/{policy_id}"),
    ("claim", "mcp-claim.json", "insurance-demo-claim-mcp",
     "http://claim-api:8000", "/mcp/claim", "get_claim_claims__claim_id__get",
     "/mcp/claim/claims/{claim_id}"),
)
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


def diagnostic_module():
    """Reuse the already-reviewed token redaction, TLS redirect, and classifier helpers."""
    path = ROOT / "scripts/konnect-diagnostic.py"
    spec = importlib.util.spec_from_file_location("konnect_diagnostic", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("diagnostic helper unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_payloads():
    """Load only the five checked-in templates; toggle enabled/auth only."""
    payloads = []
    for entity, filename, expected_name, base, route, operation, tool_path in EXPECTED:
        body = json.loads((ROOT / "config/konnect-ai-gateway" / filename).read_text())
        if body.get("name") != expected_name or body.get("enabled") is not False:
            raise ValueError("unexpected MCP template identity/state")
        if body.get("type") != "conversion-listener":
            raise ValueError("unexpected MCP template type")
        access = body.get("access")
        config = body.get("config")
        tools = body.get("tools")
        if (not isinstance(access, dict) or access.get("auth_strategies") != ["insurance-demo-mcp-key-auth"]
                or not isinstance(config, dict) or config.get("url") != base
                or config.get("route") != {"paths": [route]}
                or config.get("logging") != {"payloads": False}
                or not isinstance(tools, list) or len(tools) != 1):
            raise ValueError("unexpected MCP route/auth/logging/template shape")
        tool = tools[0]
        if (tool.get("name") != operation or tool.get("method") != "GET"
                or tool.get("path") != tool_path or "annotations" in tool):
            raise ValueError("unexpected MCP operation allowlist")
        parameters = tool.get("parameters")
        if (not isinstance(parameters, list) or len(parameters) != 1
                or parameters[0].get("in") != "path"
                or parameters[0].get("required") is not True):
            raise ValueError("unexpected MCP operation parameter")
        body["enabled"] = True
        body["access"]["auth_strategies"] = [LIVE_MCP_AUTH]
        # AI MCP Server access has a discriminator unlike the AI Model's access.
        # `consumer` binds the fixed key-auth identity to this existing consumer;
        # repeat the allow in default_tool_acls so discovery and invocation stay scoped.
        body["access"]["acl_attribute_type"] = "consumer"
        body["access"]["acls"] = {"allow": [LIVE_MCP_CONSUMER]}
        body["access"]["default_tool_acls"] = {
            "allow": [LIVE_MCP_CONSUMER], "deny": []
        }
        encoded = json.dumps(body, separators=(",", ":")).encode()
        payloads.append({
            "entity": entity,
            "name": expected_name,
            "route": route,
            "operation_id": operation,
            "body": body,
            "data": encoded,
            "sha256": hashlib.sha256(encoded).hexdigest(),
        })
    return payloads


def safe_error(error, secrets, diagnostic):
    classified = diagnostic.classify(error, secrets=secrets)
    safe = {}
    for key in ("category", "delivery", "exception_type", "http_status",
                "reason_type", "verify_code", "message_redaction", "body_classification"):
        value = classified.get(key)
        if type(value) is int or (isinstance(value, str) and len(value) <= 64):
            safe[key] = value
    code = classified.get("code")
    if isinstance(code, str) and code in diagnostic.CODES:
        safe["code"] = code
    fields = classified.get("fields")
    if isinstance(fields, list):
        safe["fields"] = sorted({field for field in fields
                                  if isinstance(field, str) and field in diagnostic.FIELDS})[:24]
    explanations = classified.get("explanations")
    if isinstance(explanations, list):
        bounded = []
        for item in explanations[:4]:
            if isinstance(item, dict) and isinstance(item.get("path"), str) and isinstance(item.get("text"), str):
                bounded.append({"path": item["path"][:128], "text": item["text"][:512]})
        safe["explanations"] = bounded
    shape = classified.get("shape")
    if isinstance(shape, list):
        bounded_shape = []
        for item in shape[:24]:
            if not isinstance(item, dict) or not isinstance(item.get("path"), str):
                continue
            row = {"path": item["path"][:128]}
            kind = item.get("type")
            if kind in {"object", "array", "other"}:
                row["type"] = kind
            count = item.get("unknown_keys")
            if type(count) is int and 0 <= count <= 32:
                row["unknown_keys"] = count
            bounded_shape.append(row)
        safe["shape"] = bounded_shape
    return safe


def _open(method, url, token, data, opener):
    request = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json",
                 "Accept": "application/json"},
    )
    with opener.open(request, timeout=30) as response:
        raw = response.read(65536)
        return response.status, raw


def _rows(raw):
    decoded = json.loads(raw)
    rows = decoded.get("data") if isinstance(decoded, dict) else decoded
    if not isinstance(rows, list):
        raise ValueError("unexpected list response")
    return [row for row in rows if isinstance(row, dict)]


def _uuid(value):
    if not isinstance(value, str) or not UUID_RE.fullmatch(value):
        return None
    try:
        return str(uuid.UUID(value))
    except ValueError:
        return None


def _local_preflight():
    payloads = build_payloads()
    return {
        "ok": True,
        "mode": "static-only",
        "gateway_id": AI_GATEWAY_ID,
        "endpoint_path": f"/v1/ai-gateways/{AI_GATEWAY_ID}/mcp-servers",
        "targets": [
            {k: item[k] for k in ("entity", "name", "route", "operation_id", "sha256")}
            for item in payloads
        ],
        "network": False,
    }


def _network_setup(diagnostic):
    # Read redaction inputs exactly once, before any network access.
    secrets = diagnostic.known_secret_values()
    token = os.environ.get("KONNECT_TOKEN")
    if not token:
        return None, None, secrets, {"ok": False, "category": "missing_authentication", "network": False}
    context = ssl.create_default_context()
    if context.verify_mode != ssl.CERT_REQUIRED or not context.check_hostname:
        return None, None, secrets, {"ok": False, "category": "tls_preflight_failed", "network": False}
    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=context), diagnostic.NoRedirect()
    )
    return token, opener, secrets, None


def read_jev_model():
    diagnostic = diagnostic_module()
    try:
        token, opener, secrets, failure = _network_setup(diagnostic)
    except Exception as error:
        return {"ok": False, "category": "redaction_or_tls_preflight_failed",
                "exception_type": type(error).__name__ if type(error).__name__ in
                {"TypeError", "ValueError", "OSError", "PermissionError", "JSONDecodeError"}
                else "UnexpectedError", "network": False}
    if failure:
        return failure
    try:
        status, raw = _open("GET", MODELS_URL, token, None, opener)
        found = [row for row in _rows(raw) if row.get("name") == "insurance-jev-decisions"]
        if len(found) != 1:
            return {"ok": False, "category": "jev_model_not_unique", "http_status": status}
        row = found[0]
        model_id = _uuid(row.get("id"))
        if not model_id:
            return {"ok": False, "category": "jev_model_id_unverified", "http_status": status}
        config = row.get("config") if isinstance(row.get("config"), dict) else {}
        balancer = config.get("balancer") if isinstance(config.get("balancer"), dict) else {}
        return {
            "ok": True, "http_status": status, "name": "insurance-jev-decisions",
            "id": model_id,
            "enabled": row.get("enabled") if isinstance(row.get("enabled"), bool) else None,
            "balancer": {
                "algorithm": balancer.get("algorithm") if balancer.get("algorithm") == "round-robin" else None,
                "retries": balancer.get("retries") if isinstance(balancer.get("retries"), int) else None,
                "failover_criteria": [] if balancer.get("failover_criteria") == [] else None,
            },
            "payload_logging": config.get("logging", {}).get("payloads")
            if isinstance(config.get("logging"), dict)
            and isinstance(config.get("logging", {}).get("payloads"), bool) else None,
        }
    except Exception as error:
        return {"ok": False, **safe_error(error, secrets, diagnostic)}


def create_mcp5():
    diagnostic = diagnostic_module()
    try:
        payloads = build_payloads()
        token, opener, secrets, failure = _network_setup(diagnostic)
    except Exception as error:
        kind = type(error).__name__
        return {"ok": False, "category": "preflight_failed",
                "exception_type": kind if kind in
                {"TypeError", "ValueError", "OSError", "PermissionError", "JSONDecodeError"}
                else "UnexpectedError", "network": False}
    if failure:
        return failure

    # Refuse all creation if any fixed name already exists; never adopt or overwrite.
    try:
        status, raw = _open("GET", MCP_URL, token, None, opener)
        wanted = {item["name"] for item in payloads}
        collisions = []
        for row in _rows(raw):
            name = row.get("name")
            if name in wanted:
                collisions.append({"name": name, "id": _uuid(row.get("id"))})
        if collisions:
            return {"ok": False, "category": "name_collision", "http_status": status,
                    "existing": collisions, "created": []}
    except Exception as error:
        return {"ok": False, "stage": "name_preflight", **safe_error(error, secrets, diagnostic),
                "created": []}

    created = []
    for item in payloads:
        try:
            status, raw = _open("POST", MCP_URL, token, item["data"], opener)
            result = json.loads(raw)
            if isinstance(result, dict) and isinstance(result.get("data"), dict):
                result = result["data"]
            server_id = _uuid(result.get("id")) if isinstance(result, dict) else None
            if status not in {200, 201} or not server_id or result.get("name") != item["name"]:
                return {"ok": False, "stage": "create_response_unverified", "http_status": status,
                        "created": created, "uncertain_name": item["name"]}
            created.append({"name": item["name"], "id": server_id, "http_status": status})
        except Exception as error:
            return {"ok": False, "stage": "create", "target": item["name"],
                    **safe_error(error, secrets, diagnostic), "created": created}
    return {"ok": True, "created": created, "stop_on_first_failure": True, "retry": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--preflight", action="store_true", help="static-only template check; no secret read or network")
    modes.add_argument("--read-jev-id", action="store_true", help="read-only Jev model metadata projection")
    modes.add_argument("--create-reviewed-mcp5", action="store_true", help="create the five fixed entities; one attempt each")
    args = parser.parse_args()
    try:
        if args.preflight:
            result = _local_preflight()
        elif args.read_jev_id:
            result = read_jev_model()
        else:
            result = create_mcp5()
    except Exception as error:
        # Never let local/import/serialization failures print traceback text.
        kind = type(error).__name__
        safe_kind = kind if kind in {
            "TypeError", "ValueError", "OSError", "PermissionError", "JSONDecodeError",
            "KeyError", "AttributeError", "ImportError",
        } else "UnexpectedError"
        result = {"ok": False, "category": "local_preflight_or_loader_failure",
                  "exception_type": safe_kind, "delivery": "unknown", "network": "unknown"}
    print(json.dumps(result, sort_keys=True))
    if not result.get("ok"):
        sys.exit(1)


if __name__ == "__main__":
    main()
