# SYSTEM_OF_RECORD.md — Isabella Villaseñor AI

**Estado:** formalizado (P0-02). Ver `src/lib/persistence/authority.ts`.

## Principio

```
PostgreSQL  (Supabase Pooler / pg)   →  AUTHORITATIVE  · source of truth
SQLite / JSON en disco               →  TRANSIENT      · cache / local / efímero
```

Ningún estado crítico debe usar SQLite/JSON como fuente de verdad. Si
PostgreSQL no está configurado y el código intenta operar un almacén
`authoritative`, `assertAuthoritativeBackend(store)` lanza
`SYSTEM_OF_RECORD_MISSING` (fail-closed).

## Clasificación de almacenes

| Almacén      | Tier           | Notas                                   |
|--------------|----------------|-----------------------------------------|
| ledger       | authoritative  | BookPI / evidencia                      |
| bookpi       | authoritative  | Bloques de evidencia                    |
| economy      | authoritative  | Valor económico                         |
| wallet       | authoritative  | Saldos y pagos                          |
| billing      | authoritative  | Planes, cuotas, facturación             |
| apiKeys      | authoritative  | Claves de API (pepper en KMS)           |
| audit        | authoritative  | Traza de auditoría firmada              |
| memory       | authoritative  | Memoria jerárquica por tenant           |
| sessions     | transient      | Sesiones de invitado (cookie httpOnly)  |
| durableJson  | transient      | `durable-json.server.ts` (cache local)  |
| featureFlags | transient      | Flags de feature                        |
| rateLimit    | transient      | Contadores de rate limit (Redis en prod)|

## Migración de estado crítico a PostgreSQL

Los módulos de estado crítico deben preferir `getPgPoolOrThrow()` y las tablas
creadas por `runPostgresMigration()` (`memory_items`, `audit_logs`,
`quantum_events`, `bookpi_blocks`, …). La migración de los repositorios que hoy
us.an SQLite (p.ej. `SqliteApiKeyRepository`) a PostgreSQL debe realizarse con
la base aprovisionada; no se hace contra un almacén transitorio.

## Ruta a producción

1. Aprovisionar `POSTGRES_URL` (requerido en producción).
2. Invocar `assertAuthoritativeBackend(...)` en toda ruta que escriba estado crítico.
3. Migrar repositorios SQLite → PostgreSQL.
4. Tratar SQLite/JSON únicamente como caché/recuperación local.
