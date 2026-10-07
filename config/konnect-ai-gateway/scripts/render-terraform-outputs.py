#!/usr/bin/env python3
"""Render selected public Terraform outputs for kongctl and Docker Compose."""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import stat
from pathlib import Path
from urllib.parse import urlsplit


CONFIG_DIR = Path(__file__).resolve().parents[1]
LOCAL_DIR = CONFIG_DIR / ".local"
OUTPUT_FILE = LOCAL_DIR / "iac-outputs.env"
REPO_ROOT = CONFIG_DIR.parents[1]


def output_value(outputs: dict[str, object], name: str) -> str:
    try:
        raw = outputs[name]
        value = raw["value"]  # type: ignore[index]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"Terraform output {name!r} is missing.") from exc
    if not isinstance(value, str) or not value:
        raise ValueError(f"Terraform output {name!r} is empty or not a string.")
    return value


def endpoint_host(value: str, output_name: str) -> tuple[str, str]:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError(f"Terraform output {output_name!r} is not a valid HTTPS endpoint.")
    if parsed.query or parsed.fragment:
        raise ValueError(f"Terraform output {output_name!r} has an unexpected query or fragment.")
    host = parsed.hostname
    port = parsed.port or 443
    if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
        raise ValueError(f"Terraform output {output_name!r} has an invalid host.")
    if not 1 <= port <= 65535:
        raise ValueError(f"Terraform output {output_name!r} has an invalid port.")
    return f"{host}:{port}", host


def dotenv_line(name: str, value: str) -> str:
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
        raise ValueError("Refusing an invalid environment variable name.")
    if "\n" in value or "\r" in value:
        raise ValueError(f"Value for {name} contains a line break.")
    # Values emitted here are hostnames, fixed local URLs, or repo-relative paths.
    if not re.fullmatch(r"[A-Za-z0-9_./:-]+", value):
        raise ValueError(f"Value for {name} contains unsupported dotenv characters.")
    return f"{name}={value}\n"


def write_private(path: Path, content: str) -> None:
    try:
        directory_stat = LOCAL_DIR.lstat()
    except FileNotFoundError:
        LOCAL_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
        directory_stat = LOCAL_DIR.lstat()
    if stat.S_ISLNK(directory_stat.st_mode) or not stat.S_ISDIR(directory_stat.st_mode):
        raise ValueError("Refusing a non-directory or symlinked local output directory.")
    LOCAL_DIR.chmod(0o700)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".iac-outputs-", suffix=".tmp", dir=LOCAL_DIR)
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
        path.chmod(0o600)
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> int:
    os.umask(0o077)
    try:
        outputs = json.load(sys.stdin)
        if not isinstance(outputs, dict):
            raise ValueError("Terraform output must be a JSON object.")

        gateway_id = output_value(outputs, "ai_gateway_id")
        if not re.fullmatch(r"[A-Za-z0-9-]+", gateway_id):
            raise ValueError("Terraform AI Gateway ID has an unexpected format.")

        cp_host, cp_server_name = endpoint_host(
            output_value(outputs, "configuration_endpoint"),
            "configuration_endpoint",
        )
        telemetry_host, telemetry_server_name = endpoint_host(
            output_value(outputs, "telemetry_endpoint"),
            "telemetry_endpoint",
        )

        values = {
            "AI_GATEWAY_ID": gateway_id,
            "KONNECT_CP_HOST": cp_host,
            "KONNECT_CP_SERVER_NAME": cp_server_name,
            "KONNECT_TELEMETRY_HOST": telemetry_host,
            "KONNECT_TELEMETRY_SERVER_NAME": telemetry_server_name,
            "KONNECT_DP_CERT_PATH": str(REPO_ROOT / "certs/cluster.crt"),
            "KONNECT_DP_KEY_PATH": str(REPO_ROOT / "certs/cluster.key"),
            "AI_GATEWAY_BASE_URL": "http://ai-gateway:8000/v1/insurance-normal",
            "AI_GATEWAY_MODEL": "insurance-normal",
            "AI_GATEWAY_TIMEOUT_MS": "20000",
            "AI_GATEWAY_JEV_URL": "http://ai-gateway:8000/jev/v1/systemone",
            "AI_GATEWAY_JEV_MODEL": "insurance-jev-decisions",
            "AI_GATEWAY_JEV_TIMEOUT_MS": "10000",
            "MCP_CUSTOMER_URL": "http://ai-gateway:8000/mcp/customer",
            "MCP_PRODUCT_URL": "http://ai-gateway:8000/mcp/product",
            "MCP_APPLICATION_URL": "http://ai-gateway:8000/mcp/application",
            "MCP_CLAIM_URL": "http://ai-gateway:8000/mcp/claim",
            "MCP_POLICY_URL": "http://ai-gateway:8000/mcp/policy",
            "MCP_TIMEOUT_MS": "5000",
        }
        rendered = "# Public Terraform outputs and fixed local demo settings. No secrets.\n"
        rendered += "".join(dotenv_line(name, value) for name, value in values.items())
        write_private(OUTPUT_FILE, rendered)
    except (json.JSONDecodeError, OSError, ValueError) as exc:
        print(f"Could not render Terraform outputs: {exc}", file=sys.stderr)
        return 1

    print(f"Rendered public Terraform outputs and demo settings: {OUTPUT_FILE}")
    print("The file contains no PAT, provider key, consumer key, or certificate content.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
