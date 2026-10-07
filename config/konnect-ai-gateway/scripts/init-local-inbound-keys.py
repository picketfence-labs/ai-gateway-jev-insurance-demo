#!/usr/bin/env python3
"""Create stable local inbound API keys without printing their values."""

from __future__ import annotations

import os
import secrets
import stat
import sys
from pathlib import Path


CONFIG_DIR = Path(__file__).resolve().parents[1]
LOCAL_DIR = CONFIG_DIR / ".local"
OUTPUT_FILE = LOCAL_DIR / "runtime-secrets.env"
KEY_NAMES = (
    "AI_GATEWAY_API_KEY",
    "AI_GATEWAY_JEV_API_KEY",
    "MCP_API_KEY",
)


def main() -> int:
    if len(sys.argv) != 1:
        print("This helper takes no arguments.", file=sys.stderr)
        return 2

    os.umask(0o077)
    try:
        directory_stat = LOCAL_DIR.lstat()
    except FileNotFoundError:
        LOCAL_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
        directory_stat = LOCAL_DIR.lstat()
    if stat.S_ISLNK(directory_stat.st_mode) or not stat.S_ISDIR(directory_stat.st_mode):
        print("Refusing a non-directory or symlinked local output directory.", file=sys.stderr)
        return 1
    LOCAL_DIR.chmod(0o700)

    try:
        existing = OUTPUT_FILE.lstat()
    except FileNotFoundError:
        existing = None

    if existing is not None:
        if stat.S_ISLNK(existing.st_mode) or not stat.S_ISREG(existing.st_mode):
            print("Refusing to use a non-regular local secret file.", file=sys.stderr)
            return 1
        OUTPUT_FILE.chmod(0o600)
        print(f"Kept existing inbound keys and restricted file permissions: {OUTPUT_FILE}")
        return 0

    values = [f"{name}={secrets.token_urlsafe(32)}" for name in KEY_NAMES]
    payload = ("# Local inbound keys. Keep this file private and out of source control.\n"
               + "\n".join(values) + "\n").encode("utf-8")

    try:
        descriptor = os.open(
            OUTPUT_FILE,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
        with os.fdopen(descriptor, "wb") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
    except FileExistsError:
        print("A local secret file appeared during setup; no file was overwritten.", file=sys.stderr)
        return 1

    print(f"Created private inbound keys without displaying their values: {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
