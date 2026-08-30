# ADR-0005: Agent Tool Policy Engine

## Status: Accepted

## Date: 20 August 2026

## Context

The Isabella AI agent can invoke tools: querying databases, executing API calls, signing records, registering IP claims, and interacting with external services. Without a policy framework, a compromised or misdirected agent (via prompt injection, model drift, or delegation token theft) could escalate its own privileges, access resources outside its tenant (ADR-0003), or perform irreversible operations without human oversight. The agent operates under delegation tokens (ADR-0002) that carry a constrained `toolScopes` array, but scope names alone are insufficient to determine whether a specific invocation is safe.

## Decision

Every tool capability is **registered** with explicit metadata and invoked through a **policy engine** that performs multi-factor authorization before execution.

### Tool Registration

Each tool is declared in a `ToolRegistry` with the following metadata:

| Field | Type | Description |
|---|---|---|
| `toolId` | `string` | Unique identifier (e.g., `evidence.append`, `ip.register`, `db.query`) |
| `scopes` | `string[]` | Required authorization scopes (from delegation token or API key) |
| `riskLevel` | `low \| medium \| high \| critical` | Inherent risk classification |
| `requiresApproval` | `boolean` | Whether human approval is needed before execution (all `critical` tools default to `true`) |
| `tenantScoped` | `boolean` | Whether the tool operates within a single tenant (default `true`) |
| `idempotent` | `boolean` | Whether re-invocation with the same parameters produces the same result |
| `description` | `string` | Human-readable description for approval UI |
| `parameterSchema` | `ZodSchema` | Zod v4 schema for parameter validation (ADR-0004 payloads also validated here) |

### Policy Engine Checks (in order)

1. **Tenant Match**: `delegationToken.tenantId === resource.tenantId` (mandatory, non-bypassable).
2. **Scope Authorization**: Every scope in the tool's `scopes` array must be present in the principal's `toolScopes`.
3. **Risk Assessment**: If `riskLevel` is `critical`, the tool is blocked unless a valid human approval token (issued within the last 5 minutes) is present in the request context.
4. **Quota Limits**: Per-tenant, per-tool rate limits and daily quotas are enforced. Exceeding a quota returns `429 Too Many Requests` with a `Retry-After` header.
5. **Approval Status**: If `requiresApproval` is `true`, the engine checks for a valid approval token. Without it, the tool returns `403 Approval Required` with the approval-request details.
6. **Parameter Validation**: The tool's `parameterSchema` (Zod v4) validates the input. Invalid parameters return `400 Bad Request` with a structured error.

### Audit Trail

Every tool invocation — whether successful, denied, or approval-pending — is recorded in the evidence ledger (ADR-0004) with operation type `agent.tool.<toolId>`.

### Approval Workflow

For tools requiring approval:

1. Agent submits a tool invocation request.
2. Policy engine validates checks 1–4, then returns an approval request with a unique `approvalId` and 5-minute TTL.
3. A human operator approves or denies via the admin UI or API.
4. Agent retries the invocation with the `approvalId` included.
5. Policy engine validates the approval token, executes the tool, and records the outcome.

### No Admin by Default

No tool is registered with implicit admin-level privileges. Administrative tools (user management, tenant configuration, ledger checkpoints) require explicit `admin.*` scopes and are always `requiresApproval: true`.

## Consequences

- **Positive**: Defense against tool escalation — an agent with `db.read` scope cannot call `db.write`. Prompt injection attacks that attempt to trick the agent into invoking unauthorized tools are blocked at the policy layer. Human-in-the-loop for critical operations provides a safety net. Every invocation is auditable.
- **Negative**: Approval workflow introduces latency for critical operations (human response time). Tool registration is verbose — adding a new tool requires defining its full metadata.
- **Negative**: The policy engine adds a synchronous authorization check on every tool call; this is a single point of failure that must be highly available. Mitigated by in-process execution (no network hop) and SQLite-backed policy data.
- **Neutral**: Risk levels are static per tool definition; dynamic risk assessment (based on context, history, or anomaly detection) is a future enhancement.

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| **Scope-only authorization (no risk levels)** | A low-risk read and a critical write might require the same scope; risk levels add necessary granularity. |
| **External policy service (OPA, Cedar)** | Adds network dependency, latency, and operational complexity disproportionate to current scale; in-process policy engine is sufficient. |
| **Pre-approve all tools at delegation time** | Removes the ability to deny specific invocations based on runtime context; increases blast radius of a stolen delegation token. |
| **No policy engine (trust the agent)** | Unacceptable risk; LLMs are susceptible to prompt injection; tool capabilities must be constrained independently of model behavior. |
| **Static ACL per agent identity** | Does not account for tenant context, delegation scope, or runtime risk; too coarse for multi-tenant, multi-tool environment. |
