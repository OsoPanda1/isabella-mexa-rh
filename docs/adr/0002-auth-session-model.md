# ADR-0002: Authentication & Session Model

## Status: Accepted

## Date: 20 August 2026

## Context

The Isabella platform serves multiple consumers: browser-based users (tenant administrators, analysts), internal service-to-service calls (microservices, scheduled jobs), and the Isabella AI agent itself. The deployment target is Vercel (serverless functions with cold starts), meaning each request may execute on a fresh instance with no in-memory state. The system must support tenant-scoped authorization (see ADR-0003) and session revocation (e.g., user logout, compromised credential, tenant deactivation). Regulatory requirements (IMPI, data-protection) demand auditability of authentication events.

## Decision

Implement a **three-tier authentication model**:

### 1. Browser Sessions — JWT + Opaque Session ID

- **Token**: JWT signed with HS256 using a rotating secret (`AUTH_SECRET`). Short-lived: **15-minute expiry**.
- **Session ID**: Opaque random string stored in SQLite (`sessions` table). Maps to `userId`, `tenantId`, `createdAt`, `expiresAt`, `revokedAt`.
- **Transport**: `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `sid`. The cookie holds the JWT. The session ID is embedded in the JWT's `jti` claim.
- **Verification**: On each request the middleware verifies JWT signature and expiry, then checks the `jti` against the SQLite session store to confirm the session has not been revoked.
- **Refresh**: Sliding window — a valid request within the last half of the token's lifetime issues a refreshed token. This avoids storing long-lived refresh tokens.

### 2. Service-to-Service — API Keys with HMAC

- **Format**: `sk_<random>`. Stored as HMAC-SHA256 hash in the `api_keys` table. Each key is scoped to a `tenantId` and a set of explicit permission scopes.
- **Transport**: `Authorization: Bearer sk_...` header.
- **No expiry by default**; revocation is immediate via database lookup.

### 3. Agent Identity — Signed Delegation Tokens

- When the Isabella AI agent acts on behalf of a user, it receives a short-lived delegation token (JWT, 5-minute TTL) that embeds the acting user's `userId`, `tenantId`, and a constrained `toolScopes` array (see ADR-0005).
- Delegation tokens cannot self-renew; they are obtained by the agent through the standard browser session flow.

### Storage

SQLite with WAL mode (same database as the evidence ledger, ADR-0004). Session and key tables are indexed on `(tenantId, revokedAt)` for fast tenant-scoped lookups.

## Consequences

- **Positive**: Stateless JWT verification avoids round-trips on every request (critical for serverless cold starts). Session store enables instant revocation. HMAC API keys avoid storing plaintext secrets. Delegation tokens limit agent blast radius.
- **Negative**: SQLite session store becomes a single point of failure; must be backed up and monitored. JWT expiry means users experience brief re-authentication prompts if idle > 15 minutes (mitigated by sliding refresh).
- **Negative**: HS256 is symmetric — the signing secret must be available to any service that verifies tokens. If the architecture moves to multi-service verification, RS256 (asymmetric) should be reconsidered.
- **Neutral**: SameSite=Lax allows normal navigation but blocks cross-site POST with cookies, preventing basic CSRF on state-changing endpoints.

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| **Opaque-only sessions (no JWT)** | Requires a database round-trip on every authenticated request; unacceptable latency in serverless cold starts. |
| **Long-lived refresh tokens** | Increases attack window; refresh token theft allows persistent impersonation; revocation of refresh tokens is a separate, often overlooked, flow. |
| **RS256 (asymmetric)** | Adds key-management complexity (public/private key pairs, JWKS endpoint) disproportionate to current single-service deployment. Revisit if moving to multi-service verification. |
| **Third-party IdP (Auth0, Clerk)** | Vendor lock-in, cost at scale, and regulatory concerns around data leaving the tenant boundary for IMPI compliance. |
| **Session-only (stateful, no JWT)** | Conflicts with serverless deployment model; every request incurs a database read. |
