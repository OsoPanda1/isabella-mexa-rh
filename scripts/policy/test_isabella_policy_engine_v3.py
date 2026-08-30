#!/usr/bin/env python3
"""Smoke tests for Isabella Core Policy Engine v3."""
import json, time, sys
from pathlib import Path
from isabella_policy_engine_v3 import IsabellaPolicyEngine, PolicyError

policy = json.loads(Path(__file__).with_name("isabella_core_policy_v3.json").read_text(encoding="utf-8"))
engine = IsabellaPolicyEngine(policy)
now = time.time()

def req(**overrides):
    x = {
        "requestId": "test-001",
        "issuedAt": now,
        "nonce": "nonce-" + "a"*20,
        "idempotencyKey": "idem-" + "b"*20,
        "route": "local",
        "dataClass": "internal",
        "purpose": "test",
        "scopes": [],
        "budgets": {"toolCalls": 0, "networkCalls": 0},
        "evidence": [],
        "domain": "general"
    }
    x.update(overrides)
    return x

r = engine.evaluate(req())
assert r["status"] == "ALLOW", r

r = engine.evaluate(req(requestId="test-002", nonce="nonce-"+"c"*20, idempotencyKey="idem-"+"d"*20,
                        domain="legal"))
assert r["status"] == "DENY" and r["policyDecision"]["code"] == "EVIDENCE_REQUIRED", r

r = engine.evaluate(req(requestId="test-003", nonce="nonce-"+"e"*20, idempotencyKey="idem-"+"f"*20,
                        route="federated", consent=False))
assert r["status"] == "DENY" and r["policyDecision"]["code"] == "FEDERATION_CONSENT_REQUIRED", r

r = engine.evaluate(req(requestId="test-004", nonce="nonce-"+"g"*20, idempotencyKey="idem-"+"h"*20,
                        dataClass="restricted"))
assert r["status"] == "DENY" and r["policyDecision"]["code"] == "RESTRICTED_DATA_DENIED", r

r = engine.evaluate(req(requestId="test-005", nonce="nonce-"+"i"*20, idempotencyKey="idem-"+"j"*20,
                        budgets={"toolCalls": 1, "networkCalls": 0}))
assert r["status"] == "DENY" and r["policyDecision"]["code"] == "TOOL_SCOPE_REQUIRED", r

r = engine.evaluate(req(requestId="test-006", nonce="nonce-"+"k"*20, idempotencyKey="idem-"+"l"*20,
                        budgets={"toolCalls": 1, "networkCalls": 0}, scopes=["tool:execute"]))
assert r["status"] == "ALLOW", r

r = engine.evaluate(req(requestId="test-007", nonce="nonce-"+"m"*20, idempotencyKey="idem-"+"n"*20,
                        budgets={"toolCalls": 0, "networkCalls": 1}))
assert r["status"] == "DENY" and r["policyDecision"]["code"] == "NETWORK_SCOPE_REQUIRED", r

print("All Isabella Core Policy v3 smoke tests passed.")
