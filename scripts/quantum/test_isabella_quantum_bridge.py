#!/usr/bin/env python3
"""Smoke tests for Isabella Quantum Bridge v3."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

BRIDGE = Path(__file__).with_name("isabella_quantum_bridge_v3.py")


def run(payload: dict) -> dict:
    proc = subprocess.run(
        [sys.executable, str(BRIDGE), "--stdio"],
        input=(json.dumps(payload) + "\n").encode(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    assert proc.stdout, proc.stderr.decode()
    result = json.loads(proc.stdout.decode())
    return result


def base(**extra):
    payload = {
        "schema": "pennylane-request-v3",
        "requestId": "smoke-test-001",
        "tenantId": "test",
        "task": "execute",
        "provider": "default.qubit",
        "wires": 2,
        "features": [0.1, 0.2],
        "weights": [0.3, 0.4],
        "scopes": ["quantum:execute"],
    }
    payload.update(extra)
    return payload


def main() -> None:
    result = run(base())
    assert result["status"] in {"ok", "degraded"}, result
    assert result["requestId"] == "smoke-test-001"

    diag = run(base(task="diagnose"))
    assert diag["status"] == "ok", diag
    assert "default.qubit" in diag["devices"]

    bad = run(base(scopes=[]))
    assert bad["status"] == "error", bad
    assert bad["error"]["code"] == "MISSING_SCOPE", bad

    print("Smoke tests passed.")


if __name__ == "__main__":
    main()
