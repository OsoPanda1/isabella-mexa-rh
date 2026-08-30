#!/usr/bin/env python3
"""Isabella Core Policy Engine v3 — fail-closed request authorization.

Standard-library implementation. JSON policy is validated structurally by the
companion schema; this engine enforces runtime invariants, replay protection,
budgets, evidence requirements, route/data-class rules and immutable audit
hashes. It deliberately does not execute tools or network operations.
"""
from __future__ import annotations
import hashlib, hmac, json, re, secrets, time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional

SECRET_PATTERNS = [
    re.compile(r"(?i)\b(sk-[A-Za-z0-9_-]{12,})\b"),
    re.compile(r"(?i)\b(api[_-]?key|token|secret|password)\s*[:=]\s*\S+"),
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~-]+"),
]

class PolicyError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message); self.code = code; self.message = message

def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                      allow_nan=False).encode("utf-8")

def sha3(obj: Any) -> str:
    return hashlib.sha3_512(canonical(obj)).hexdigest()

def redact(value: Any) -> Any:
    if isinstance(value, str):
        out = value
        for p in SECRET_PATTERNS:
            out = p.sub("[REDACTED]", out)
        return out
    if isinstance(value, dict):
        return {str(k): redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value

def require(condition: bool, code: str, message: str) -> None:
    if not condition:
        raise PolicyError(code, message)

def verify_hmac(payload: bytes, signature_hex: str, secret: bytes) -> None:
    require(len(signature_hex) == 64, "BAD_SIGNATURE", "invalid HMAC length")
    expected = hmac.new(secret, payload, hashlib.sha256).hexdigest()
    require(hmac.compare_digest(expected, signature_hex), "BAD_SIGNATURE", "signature verification failed")

@dataclass(frozen=True)
class Decision:
    allowed: bool
    code: str
    reason: str
    route: str
    obligations: tuple[str, ...]

class ReplayGuard:
    """Bounded in-memory replay/idempotency guard for one worker instance."""
    def __init__(self, ttl: int):
        self.ttl = ttl
        self._seen: Dict[str, float] = {}
    def check_and_record(self, key: str, now: float) -> None:
        expired = [k for k,v in self._seen.items() if v <= now]
        for k in expired: del self._seen[k]
        require(key not in self._seen, "REPLAY_DETECTED", "nonce or idempotency key already used")
        self._seen[key] = now + self.ttl

class IsabellaPolicyEngine:
    def __init__(self, policy: Dict[str, Any]):
        self.p = policy
        self.replay = ReplayGuard(policy["limits"]["requestTtlSeconds"])

    def authorize(self, request: Dict[str, Any], *, now: Optional[float] = None) -> Decision:
        now = time.time() if now is None else now
        require(self.p["mode"] == "FAIL_CLOSED", "POLICY_MODE", "policy must be fail-closed")
        required = ["requestId","issuedAt","nonce","idempotencyKey","route","dataClass",
                    "purpose","scopes","budgets","evidence"]
        for k in required: require(k in request, "MISSING_FIELD", f"missing field: {k}")

        require(isinstance(request["requestId"], str) and 1 <= len(request["requestId"]) <= 128,
                "BAD_REQUEST_ID", "invalid requestId")
        issued = float(request["issuedAt"])
        require(abs(now - issued) <= self.p["limits"]["requestTtlSeconds"],
                "REQUEST_EXPIRED", "request outside allowed TTL")

        nonce = request["nonce"]; idem = request["idempotencyKey"]
        require(isinstance(nonce, str) and 16 <= len(nonce) <= 256, "BAD_NONCE", "invalid nonce")
        require(isinstance(idem, str) and 16 <= len(idem) <= 256, "BAD_IDEMPOTENCY", "invalid idempotency key")
        self.replay.check_and_record(nonce + ":" + idem, now)

        route = request["route"]
        data_class = request["dataClass"]
        require(route in self.p["routing"]["allowedRoutes"], "ROUTE_DENIED", "route not allowed")
        require(data_class in self.p["privacy"]["dataClasses"], "DATA_CLASS_INVALID", "unknown data class")
        if data_class in self.p["routing"]["denyIfDataClass"]:
            raise PolicyError("RESTRICTED_DATA_DENIED", "restricted data cannot enter this policy path")
        if route == "federated":
            require(bool(request.get("consent", False)), "FEDERATION_CONSENT_REQUIRED",
                    "federated route requires explicit consent")

        scopes = request["scopes"]
        require(isinstance(scopes, list) and all(isinstance(x, str) for x in scopes),
                "SCOPES_INVALID", "scopes must be a string array")
        budgets = request["budgets"]
        require(isinstance(budgets, dict), "BUDGET_INVALID", "budgets must be an object")
        require(int(budgets.get("toolCalls", 0)) <= self.p["limits"]["maxToolCalls"],
                "TOOL_BUDGET_EXCEEDED", "tool call budget exceeded")
        require(int(budgets.get("networkCalls", 0)) <= self.p["limits"]["maxNetworkCalls"],
                "NETWORK_BUDGET_EXCEEDED", "network call budget exceeded")
        if int(budgets.get("networkCalls", 0)) > 0:
            require("network:execute" in scopes, "NETWORK_SCOPE_REQUIRED", "network scope required")
        if int(budgets.get("toolCalls", 0)) > 0:
            require("tool:execute" in scopes, "TOOL_SCOPE_REQUIRED", "tool scope required")

        evidence = request["evidence"]
        require(isinstance(evidence, list), "EVIDENCE_INVALID", "evidence must be an array")
        require(len(evidence) <= self.p["limits"]["maxEvidenceItems"], "EVIDENCE_LIMIT", "too many evidence items")
        evidence_bytes = len(canonical(evidence))
        require(evidence_bytes <= self.p["limits"]["maxEvidenceBytes"], "EVIDENCE_BYTES_LIMIT",
                "evidence payload too large")

        domain = request.get("domain", "general")
        if domain in self.p["grounding"]["requireEvidenceFor"]:
            require(len(evidence) >= self.p["grounding"]["minEvidence"],
                    "EVIDENCE_REQUIRED", f"evidence required for domain: {domain}")
        if request.get("claimType") in self.p["responseContract"]["denyWithoutEvidence"]:
            require(len(evidence) > 0, "CLAIM_REQUIRES_EVIDENCE", "claim requires evidence")

        return Decision(True, "ALLOW", "request satisfies policy", route,
                        ("redact-logs", "attach-provenance", "emit-audit-event"))

    def audit_event(self, request: Dict[str, Any], decision: Decision) -> Dict[str, Any]:
        event = {
            "eventType": "ISABELLA_POLICY_DECISION",
            "requestId": request["requestId"],
            "policyId": self.p["policyId"],
            "policyVersion": self.p["schemaVersion"],
            "decision": {
                "allowed": decision.allowed, "code": decision.code,
                "route": decision.route, "reason": decision.reason,
                "obligations": list(decision.obligations),
            },
            "requestFingerprint": sha3({
                "requestId": request["requestId"],
                "purpose": request["purpose"],
                "route": request["route"],
                "dataClass": request["dataClass"],
                "scopes": request["scopes"],
            }),
            "timestamp": time.time(),
        }
        event["eventHash"] = sha3(redact(event))
        return redact(event)

    def evaluate(self, request: Dict[str, Any]) -> Dict[str, Any]:
        started = time.perf_counter()
        try:
            decision = self.authorize(request)
            status = "ALLOW"
            reason = decision.reason
        except PolicyError as exc:
            decision = Decision(False, exc.code, exc.message, request.get("route", "local"), ())
            status = "DENY"; reason = exc.message
        event = self.audit_event(request, decision)
        return {
            "status": status,
            "requestId": request.get("requestId", "unknown"),
            "policyDecision": {
                "allowed": decision.allowed,
                "code": decision.code,
                "reason": reason,
                "route": decision.route,
                "obligations": list(decision.obligations),
            },
            "provenance": {
                "systemIdentifier": self.p["systemIdentifier"],
                "policyId": self.p["policyId"],
                "schemaVersion": self.p["schemaVersion"],
                "retrievalIsNotProof": self.p["grounding"]["retrievalIsNotProof"],
            },
            "audit": event,
            "runtimeMs": int((time.perf_counter() - started) * 1000),
        }

def main() -> int:
    import argparse, pathlib
    ap = argparse.ArgumentParser()
    ap.add_argument("policy")
    args = ap.parse_args()
    policy = json.loads(pathlib.Path(args.policy).read_text(encoding="utf-8"))
    engine = IsabellaPolicyEngine(policy)
    import sys
    for line in sys.stdin:
        if not line.strip(): continue
        request = json.loads(line)
        print(json.dumps(engine.evaluate(request), ensure_ascii=False, sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
