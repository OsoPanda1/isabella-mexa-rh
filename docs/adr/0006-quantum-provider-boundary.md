# ADR-0006: Quantum Provider Boundary — Simulated vs. Production Capabilities

## Status: Accepted

## Date: 20 August 2026

## Context

The Isabella platform includes experimental post-quantum cryptography modules: ML-KEM-768 (key encapsulation), ML-DSA-87 (digital signatures), SLH-DSA-128s (stateless hash-based signatures), and integrations with HSM and TEE (Trusted Execution Environment) providers. These are critical for long-lived IP records and identity documents that must remain secure against future quantum adversaries. However, the current implementations are **simulations and prototypes** — they use software emulation of the algorithms without verified hardware backing, provider SLAs, or formal certification. There is a risk that stakeholders, regulators, or clients may interpret "quantum-ready" marketing or documentation as implying production-grade quantum security, which would be a misrepresentation.

## Decision

**Quantum capabilities are optional, explicitly gated, and strictly labeled by maturity level.**

### Feature Gate

- All quantum-related code paths are behind the `FEATURE_LAB_MODE=true` environment variable.
- When `FEATURE_LAB_MODE` is `false` (default in production), quantum endpoints, tools, and cryptographic operations are **disabled and invisible** — they do not appear in tool registries (ADR-0005), API schemas, or documentation.
- The gate is checked at module load time; quantum libraries are not even imported when the feature is off.

### Maturity Labels

Every quantum implementation is classified:

| Label | Meaning | Current Status |
|---|---|---|
| `PROTOTYPE` | Software-only simulation; no hardware verification; algorithm correctness only | ML-KEM-768, ML-DSA-87, SLH-DSA-128s |
| `SIMULATED` | Provider integration tested against mock/sandbox endpoints | HSM (softHSM), TEE (simulation mode) |
| `PRODUCTION` | Verified provider credentials, hardware attestation, SLA agreement, budget allocated | **None currently** |

Labels are embedded in code as metadata on each provider module and emitted in evidence ledger records (ADR-0004) via the `metadata.maturity` field.

### Production Promotion Requirements

No quantum implementation may be labeled `PRODUCTION` until **all** of the following are satisfied:

1. **Verified Provider Credentials**: The hardware provider (HSM vendor, TEE manufacturer) has been independently audited and their attestation chain is verified.
2. **Budget Allocation**: A financial commitment for ongoing provider costs is approved and documented.
3. **SLA Agreement**: A service-level agreement with defined uptime, latency, and incident response commitments is signed.
4. **Hardware Attestation**: The specific hardware revision and firmware version are recorded in the evidence ledger, and a remote attestation flow is implemented and tested.
5. **Penetration Test**: A dedicated security assessment of the quantum integration path has been completed and findings resolved.

### Evidence Ledger Integration

- When a quantum operation is performed in `LAB_MODE`, the evidence ledger record includes `"maturity": "PROTOTYPE"` or `"maturity": "SIMULATED"` in its metadata.
- Verification endpoints (ADR-0004) surface the maturity label alongside integrity status.
- Any claim, document, or API response that references quantum security **must** include the maturity label.

### Documentation Standards

- All documentation must distinguish between current capability (simulation) and target capability (production).
- Marketing and institutional materials must not state "quantum-secure" or "post-quantum" without the qualifier "prototype" or "in development" until `PRODUCTION` status is achieved.

## Consequences

- **Positive**: Prevents over-claiming of capability maturity. Ensures honest representation to regulators (IMPI), clients, and courts using the evidence ledger. Creates a clear, auditable path from prototype to production.
- **Negative**: Quantum features are not available in production deployments by default; customers cannot use post-quantum cryptography until the promotion requirements are met. This may slow adoption among security-forward clients.
- **Negative**: The `FEATURE_LAB_MODE` gate adds a deployment configuration dimension; operations teams must understand and manage this flag.
- **Neutral**: The maturity label system is extensible — new quantum providers or algorithms can be added at any maturity level without changing the framework.

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| **Ship quantum as production by default** | Misrepresents current capability; creates legal and reputational risk; the simulations have not undergone hardware verification. |
| **Remove quantum code entirely until production-ready** | Loses the ability to test, develop, and demonstrate the quantum path; hinders developer onboarding and stakeholder demos. |
| **Maturity labels without feature gate** | Quantum endpoints would be visible and potentially called in production, creating false expectations and untested code paths in production traffic. |
| **Separate repository for quantum modules** | Fragments the codebase; makes it harder to maintain consistency with the evidence ledger (ADR-0004) and tool policy engine (ADR-0005). |
| **Third-party quantum certification body** | No widely-accepted certification for post-quantum cloud integrations exists yet; self-classification with clear criteria is more practical. |
