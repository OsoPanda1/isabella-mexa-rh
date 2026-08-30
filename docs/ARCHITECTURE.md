# ARCHITECTURE.md — Isabella Villaseñor AI

## Arquitectura de referencia

```
+--------------------+       +-----------------------+
| Cliente / RDM Hub  | ----> | Gateway API + mTLS    |
+--------------------+       +-----------+-----------+
                                        |
                              +---------v---------+
                              | Admission Control |
                              | schema/rate/auth  |
                              +---------+---------+
                                        |
                 +----------------------+----------------------+
                 |                      |                      |
        +--------v--------+    +--------v--------+    +--------v--------+
        | Policy PDP      |    | Isabella Adapter |    | Evidence Plane  |
        | consent/egress  |    | session/caps     |    | MCP/RAG/claims  |
        +--------+--------+    +--------+--------+    +--------+--------+
                 |                      |                      |
        +--------v--------+    +--------v--------+    +--------v--------+
        | Tool Sandbox    |    | Model Runtime   |    | Provenance Ledger|
        | seccomp/caps    |    | local/federated |    | hash/sign/events |
        +-----------------+    +-----------------+    +-----------------+
```

## Zonas de confianza

- **Zona pública:** clientes y contenido externo no confiable.
- **Zona de admisión:** gateway, validación, rate limiting y autenticación.
- **Zona de control:** PDP, registry de capacidades, trust store y configuración.
- **Zona de inferencia:** runtimes locales o federados aislados.
- **Zona de evidencia:** índices, conectores MCP y cache documental.
- **Zona de auditoría:** ledger, métricas y almacenamiento de eventos.
- **Zona de secretos:** KMS/Vault/HSM; nunca dentro de imágenes o repositorios.

## Componentes

| Componente | Responsabilidad | No debe hacer |
|---|---|---|
| Gateway | identidad, esquema, límites, trazas | decidir verdad epistémica |
| Isabella Adapter | traducir contratos y capacidades | elevar privilegios |
| Orchestrator | sesiones, timeouts, reintentos | saltarse el PDP |
| Policy PDP | autorizar modelo, herramientas y egress | generar texto de usuario |
| Claim Radar | claims, evidencia y estado | firmar releases |
| MCP Hub | consultar fuentes permitidas | declarar prueba automática |
| Runtime | inferencia | autorizar red o herramientas |
| Sandbox | ejecución limitada | acceder a secretos globales |
| Ledger | provenance y auditoría | almacenar prompts sin redacción |
| Kill-Switch | congelar, aislar, restaurar | purgar evidencia forense |

## Principios

1. Contrato antes que implementación
2. Local-first
3. Egress deny-by-default
4. Fail closed
5. Separación de poderes
6. Provenance completa
7. Mínimo privilegio
8. Reversibilidad
9. Incertidumbre visible
10. Compatibilidad evolutiva
