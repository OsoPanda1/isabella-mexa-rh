#!/usr/bin/env python3
"""Smoke tests for Isabella Scope Engine v2."""
from __future__ import annotations
import json, time, sys
from pathlib import Path
from isabella_scope_engine_v2 import ScopeAuthorizer, AuthorizationError

catalog = json.loads(Path(__file__).with_name("isabella_scopes_catalog_v2.json").read_text(encoding="utf-8"))
auth = ScopeAuthorizer(catalog)
now = time.time()

def claims(**kw):
    x = {
        "sub": "principal-1", "tenantId": "tenant-a",
        "scopes": ["memory:read"], "roles": ["citizen"],
        "iat": now - 10, "exp": now + 300, "jti": "jti-" + str(time.time_ns()),
        "iss": "https://auth.isabella.ai", "aud": "isabella-api"
    }
    x.update(kw)
    return x

# 1. Happy path — memory:read within own tenant
d = auth.authorize(claims(), "memory:read", resource_tenant="tenant-a", now=now)
assert d.allowed, d

# 2. Tenant isolation — cross-tenant denial
try:
    auth.authorize(claims(), "memory:read", resource_tenant="tenant-b", now=now)
    raise AssertionError("tenant isolation expected")
except AuthorizationError as e:
    assert e.code == "TENANT_BOUNDARY_VIOLATION"

# 3. Scope denial — citizen lacks memory:write
try:
    auth.authorize(claims(), "memory:write", resource_tenant="tenant-a", now=now)
    raise AssertionError("scope denial expected")
except AuthorizationError as e:
    assert e.code == "SCOPE_DENIED"

# 4. Wildcard denied for non-system role
try:
    auth.authorize(claims(scopes=["*"], roles=["admin"]), "admin:policy",
                   assurance="hardware-backed", step_up=True, dual_control=True, now=now)
    raise AssertionError("wildcard should be denied for non-system")
except AuthorizationError as e:
    assert e.code == "WILDCARD_DENIED"

# 5. Dual control required for admin:policy
try:
    auth.authorize(claims(scopes=["admin:policy"], roles=["governance_admin"]),
                   "admin:policy", assurance="hardware-backed", step_up=True,
                   dual_control=False, now=now)
    raise AssertionError("dual control expected")
except AuthorizationError as e:
    assert e.code == "DUAL_CONTROL_REQUIRED"

# 6. Wildcard allowed for system role
d = auth.authorize(
    claims(scopes=["*"], roles=["system"]), "memory:read",
    resource_tenant="tenant-a", now=now
)
assert d.allowed, d

# 7. Assurance insufficient — local auth for hardware-backed scope
try:
    auth.authorize(
        claims(scopes=["hsm:sign"], roles=["governance_admin"]),
        "hsm:sign", assurance="local", step_up=True, dual_control=False, now=now
    )
    raise AssertionError("assurance insufficient expected")
except AuthorizationError as e:
    assert e.code == "ASSURANCE_INSUFFICIENT"

# 8. Step-up required for quantum:braket
try:
    auth.authorize(
        claims(scopes=["quantum:braket"], roles=["operator"]),
        "quantum:braket", assurance="mtls", step_up=False, now=now
    )
    raise AssertionError("step-up required expected")
except AuthorizationError as e:
    assert e.code == "STEP_UP_REQUIRED"

# 9. Full authorization — admin:policy with all requirements met
d = auth.authorize(
    claims(scopes=["admin:policy"], roles=["governance_admin"]),
    "admin:policy", assurance="hardware-backed", step_up=True,
    dual_control=True, now=now
)
assert d.allowed, d
assert "step-up-verified" in d.obligations
assert "dual-control-verified" in d.obligations

# 10. Role insufficient — citizen cannot use tools:execute (must have scope to reach role check)
try:
    auth.authorize(
        claims(scopes=["tools:execute"], roles=["citizen"]),
        "tools:execute", resource_tenant="tenant-a", now=now
    )
    raise AssertionError("role insufficient expected")
except AuthorizationError as e:
    assert e.code == "ROLE_INSUFFICIENT"

# 11. Unknown scope
try:
    auth.authorize(claims(roles=["operator"]), "nonexistent:scope", now=now)
    raise AssertionError("unknown scope expected")
except AuthorizationError as e:
    assert e.code == "UNKNOWN_SCOPE"

# 12. Token expired
try:
    auth.authorize(claims(iat=now - 7000, exp=now - 6000), "memory:read", now=now)
    raise AssertionError("token expired expected")
except AuthorizationError as e:
    assert e.code == "TOKEN_EXPIRED"

# 13. Replay detection — same jti twice
jti_val = "replay-test-" + str(time.time_ns())
auth.authorize(claims(jti=jti_val, iat=now - 1, exp=now + 600), "memory:read", now=now)
try:
    auth.authorize(claims(jti=jti_val, iat=now - 1, exp=now + 600), "memory:read", now=now)
    raise AssertionError("replay expected")
except AuthorizationError as e:
    assert e.code == "TOKEN_REPLAY"

# 14. Kill-switch:activate requires system + hardware + step-up + dual-control
try:
    auth.authorize(
        claims(scopes=["kill-switch:activate"], roles=["admin"]),
        "kill-switch:activate", assurance="hardware-backed",
        step_up=True, dual_control=True, now=now
    )
    raise AssertionError("role insufficient expected for admin on kill-switch")
except AuthorizationError as e:
    assert e.code == "ROLE_INSUFFICIENT"

# 15. Verify audit event has eventDigest
d = auth.authorize(claims(jti="audit-test-" + str(time.time_ns())), "memory:read", now=now)
audit = auth.audit(d)
assert "eventDigest" in audit
assert audit["eventType"] == "isabella.authorization.decision"

print("All Isabella Scope Engine v2 smoke tests passed.")
