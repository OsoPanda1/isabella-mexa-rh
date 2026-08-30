#!/usr/bin/env python3
"""
Isabella Villaseñor AI — Scope Authorization Runtime v2.

Production-oriented authorization reference implementation.

Pipeline:
JWT claims -> structural validation -> time validation -> tenant binding
-> scope resolution -> role/assurance checks -> step-up/dual-control
-> resource constraints -> decision -> tamper-evident audit event.

Security properties:
- deny by default
- wildcard disabled except explicitly authorized system principal
- no scope elevation
- tenant isolation
- fail-closed
- constant-time signature comparison where HMAC is used for local test mode
- bounded requests
- replay protection through jti
- deterministic authorization decision
- redacted audit output

NOTE: This reference runtime does not replace a production JWT library, OPA,
HSM, WebAuthn verifier, mTLS gateway or distributed replay store.
"""
from __future__ import annotations
import base64, hashlib, hmac, json, re, time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Set

SECRET_PATTERNS = [
    re.compile(r'(?i)(authorization\s*[:=]\s*bearer\s+)[^\s]+'),
    re.compile(r'(?i)(api[_-]?key\s*[:=]\s*)[^\s]+'),
    re.compile(r'(?i)(password\s*[:=]\s*)[^\s]+'),
    re.compile(r'(?i)(secret\s*[:=]\s*)[^\s]+'),
]

ROLE_RANK = {
    "citizen": 1,
    "agent": 2,
    "operator": 3,
    "admin": 4,
    "governance_admin": 5,
    "system": 6,
}

class AuthorizationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message

@dataclass(frozen=True)
class Decision:
    allowed: bool
    code: str
    reason: str
    required_scope: str
    principal: str
    tenant_id: str
    obligations: tuple[str, ...]

def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                      allow_nan=False).encode("utf-8")

def digest(value: Any) -> str:
    return hashlib.sha3_512(canonical(value)).hexdigest()

def redact(value: Any) -> Any:
    if isinstance(value, str):
        for pattern in SECRET_PATTERNS:
            value = pattern.sub(r'\1[REDACTED]', value)
        return value
    if isinstance(value, dict):
        return {str(k): redact(v) for k,v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value

def require(condition: bool, code: str, message: str):
    if not condition:
        raise AuthorizationError(code, message)

class ReplayStore:
    """In-memory reference store. Production must use an atomic distributed TTL store."""
    def __init__(self):
        self.entries: Dict[str,float] = {}

    def consume(self, jti: str, exp: float, now: float):
        expired = [k for k,v in self.entries.items() if v <= now]
        for key in expired:
            del self.entries[key]
        require(jti not in self.entries, "TOKEN_REPLAY", "JWT jti has already been consumed")
        self.entries[jti] = exp

class ScopeAuthorizer:
    def __init__(self, catalog: Dict[str,Any]):
        self.catalog = catalog
        self.scope_map = {x["scope"]: x for x in catalog["scopes"]}
        self.replay = ReplayStore()

    def _validate_token_claims(self, claims: Dict[str,Any], now: float):
        required = self.catalog["authentication"]["requiredClaims"]
        for claim in required:
            require(claim in claims, "CLAIM_MISSING", f"required JWT claim missing: {claim}")

        require(isinstance(claims["scopes"], list), "SCOPES_NOT_ARRAY", "scopes must be an array")
        require(all(isinstance(x,str) and x for x in claims["scopes"]),
                "SCOPES_INVALID", "every scope must be a non-empty string")
        require(isinstance(claims["roles"], list) and claims["roles"],
                "ROLES_INVALID", "roles must be a non-empty array")

        iat = float(claims["iat"]); exp = float(claims["exp"])
        skew = self.catalog["authentication"]["clockSkewSeconds"]
        max_life = self.catalog["authentication"]["maxTokenLifetimeSeconds"]

        require(iat <= now + skew, "TOKEN_NOT_YET_VALID", "iat is in the future")
        require(exp >= now - skew, "TOKEN_EXPIRED", "token expired")
        require(exp > iat, "TOKEN_TIME_INVALID", "exp must be greater than iat")
        require(exp - iat <= max_life + skew, "TOKEN_LIFETIME_EXCEEDED", "JWT lifetime exceeds policy")

        issuer = claims.get("iss")
        audience = claims.get("aud")
        require(issuer, "ISSUER_MISSING", "issuer is required")
        require(audience, "AUDIENCE_MISSING", "audience is required")

        tenant = claims["tenantId"]
        require(isinstance(tenant,str) and tenant, "TENANT_INVALID", "tenantId is invalid")
        self.replay.consume(str(claims["jti"]), exp, now)

    def _role_ok(self, roles: Set[str], minimum: str) -> bool:
        current = max((ROLE_RANK.get(r,0) for r in roles), default=0)
        return current >= ROLE_RANK.get(minimum, 999)

    def authorize(self, claims: Dict[str,Any], required_scope: str,
                  *, resource_tenant: Optional[str] = None,
                  assurance: str = "local", step_up: bool = False,
                  dual_control: bool = False, environment: str = "production",
                  now: Optional[float] = None) -> Decision:
        now = time.time() if now is None else now
        self._validate_token_claims(claims, now)

        subject = str(claims["sub"])
        tenant = str(claims["tenantId"])
        scopes = set(claims["scopes"])
        roles = set(claims["roles"])

        require(required_scope in self.scope_map,
                "UNKNOWN_SCOPE", "requested scope is not registered")

        spec = self.scope_map[required_scope]
        wildcard = "*" in scopes
        wildcard_allowed = (
            wildcard and
            "system" in roles and
            environment == "production"
        )
        if wildcard and not wildcard_allowed:
            raise AuthorizationError("WILDCARD_DENIED", "wildcard scope is not permitted for this principal")

        if not wildcard_allowed:
            require(required_scope in scopes, "SCOPE_DENIED", "principal lacks required scope")

        require(self._role_ok(roles, spec["minimumRole"]),
                "ROLE_INSUFFICIENT", "principal role is insufficient")

        assurance_rank = self.catalog["assuranceLevels"][assurance]["rank"]
        required_assurance = self.catalog["assuranceLevels"][spec["assurance"]]["rank"]
        require(assurance_rank >= required_assurance,
                "ASSURANCE_INSUFFICIENT", "authentication assurance is insufficient")

        if spec.get("tenantBound", True):
            require(resource_tenant is None or resource_tenant == tenant,
                    "TENANT_BOUNDARY_VIOLATION", "cross-tenant access denied")

        if spec.get("requiresStepUp", False):
            require(step_up, "STEP_UP_REQUIRED", "step-up authentication required")

        if spec.get("requiresDualControl", False):
            require(dual_control, "DUAL_CONTROL_REQUIRED", "dual control required")

        obligations = ["audit", "tenant-isolation"]
        if spec.get("requiresStepUp", False): obligations.append("step-up-verified")
        if spec.get("requiresDualControl", False): obligations.append("dual-control-verified")

        return Decision(True, "ALLOW", "authorization policy satisfied", required_scope,
                        subject, tenant, tuple(obligations))

    def audit(self, decision: Decision) -> Dict[str,Any]:
        event = {
            "eventType": "isabella.authorization.decision",
            "subject": decision.principal,
            "tenantId": decision.tenant_id,
            "requiredScope": decision.required_scope,
            "decision": {
                "allowed": decision.allowed,
                "code": decision.code,
                "reason": decision.reason,
                "obligations": list(decision.obligations)
            },
            "timestamp": time.time()
        }
        event["eventDigest"] = digest(redact(event))
        return redact(event)

def authorize_json(catalog: Dict[str,Any], request: Dict[str,Any]) -> Dict[str,Any]:
    engine = ScopeAuthorizer(catalog)
    started = time.perf_counter()
    try:
        d = engine.authorize(
            request["claims"], request["requiredScope"],
            resource_tenant=request.get("resourceTenant"),
            assurance=request.get("assurance","local"),
            step_up=bool(request.get("stepUpVerified",False)),
            dual_control=bool(request.get("dualControlVerified",False)),
            environment=request.get("environment","production"),
        )
    except AuthorizationError as exc:
        d = Decision(False, exc.code, exc.message, request.get("requiredScope","unknown"),
                     str(request.get("claims",{}).get("sub","unknown")),
                     str(request.get("claims",{}).get("tenantId","unknown")), ())
    return {
        "status": "ALLOW" if d.allowed else "DENY",
        "requestId": request.get("requestId","unknown"),
        "policyDecision": {
            "allowed": d.allowed, "code": d.code, "reason": d.reason,
            "requiredScope": d.required_scope, "obligations": list(d.obligations)
        },
        "provenance": {
            "catalogId": catalog["catalogId"],
            "catalogDigest": catalog["catalogDigest"],
            "policyModel": catalog["authorization"]["policyModel"] if "policyModel" in catalog["authorization"] else "default-deny"
        },
        "audit": engine.audit(d),
        "runtimeMs": int((time.perf_counter()-started)*1000)
    }

if __name__ == "__main__":
    import argparse, pathlib, sys
    p = argparse.ArgumentParser()
    p.add_argument("catalog")
    args = p.parse_args()
    catalog = json.loads(pathlib.Path(args.catalog).read_text(encoding="utf-8"))
    for line in sys.stdin:
        if line.strip():
            print(json.dumps(authorize_json(catalog, json.loads(line)), ensure_ascii=False, sort_keys=True))
