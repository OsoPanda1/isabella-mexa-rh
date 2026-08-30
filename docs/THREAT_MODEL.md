# THREAT_MODEL.md — Isabella Villaseñor AI

## Activos críticos

- Claves de firma y confianza (ML-DSA, ML-KEM, HSM)
- Prompts, documentos y datos territoriales
- Modelos, embeddings e índices (LITLE)
- Políticas y capacidades de herramientas
- Evidencia y provenance (BookPI ledger)
- Disponibilidad del Nodo Cero (Real del Monte)

## Matriz de amenazas

| Amenaza | Control obligatorio | Evidencia |
|---|---|---|
| **Prompt injection** | Separación de canales, tool allowlist, contenido no confiable etiquetado | Suite adversarial |
| **Exfiltración** | Egress deny-by-default, DLP, redacción | Logs de firewall y DLP |
| **Modelo adulterado** | Digest fijado, firma de bundle, SBOM | SLSA/in-toto + firma |
| **Replay** | Nonce, expiración, idempotency key | Rechazo de duplicados |
| **Escalada de privilegios** | Identidad por workload, capabilities mínimas | Decisiones PDP |
| **SSRF** | Proxy allowlist, DNS policy | Pruebas SSRF |
| **Supply chain** | Lockfiles, SBOM, escaneo CVE, builds reproducibles | Artefactos CI |
| **RAG poisoning** | Ingestión firmada y revisión | Corpus auditado |
| **DoS lógico** | Cuotas, circuit breakers, límites de contexto | Prueba de carga |
| **Falso respaldo** | Status epistemológico, revisión humana | Claim Radar |

## Herramientas: mínimo privilegio

Cada herramienta declara:

```json
{
  "toolId": "territorial.search",
  "version": "1.0.0",
  "capabilities": ["read:public-territorial-data"],
  "network": { "mode": "allowlist", "hosts": [] },
  "filesystem": "ephemeral",
  "maxRuntimeMs": 3000,
  "requiresHumanApproval": false
}
```

## Seguridad de herramientas

- El modelo NUNCA autoriza sus propias herramientas o privilegios.
- El PDP es una autoridad independiente.
- Cada tool call tiene una autorización verificable con requestId y traceId.
- Herramientas de riesgo alto/crítico requieren aprobación humana.
