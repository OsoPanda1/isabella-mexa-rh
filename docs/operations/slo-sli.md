# SLO_SLI.md — Definiciones de SLO/SLI

**Estado:** diseno para implementacion.
**Fecha:** 20 agosto 2026.

## 1. Definiciones

| Termino | Definicion |
|---|---|
| **SLO** (Service Level Objective) | Meta interna de rendimiento que el servicio se compromete a cumplir |
| **SLI** (Service Level Indicator) | Metrica concreta y medible que evalua el cumplimiento del SLO |
| **SLA** (Service Level Agreement) | Compromiso contractual externo derivado de los SLOs internos |
| **Error budget** | Tolerancia permitida de fallos dentro del periodo del SLO |
| **Incumplimiento** | SLI fuera de rango por mas de la ventana de evaluacion |

## 2. SLOs definidos

### SLO-1: Disponibilidad de API

| Campo | Valor |
|---|---|
| **SLI** | Fraccion de requests exitosos (HTTP 2xx/3xx) sobre total de requests |
| **SLO** | 99.9% mensual |
| **Periodo** | Calendario mensual (UTC) |
| **Error budget** | 43.8 minutos de downtime por mes (0.1% de 720h) |
| **Medicion** | Contador de requests por status code en `observability/counters` |

**Calculo:**

```
SLI_availability = (requests_2xx + requests_3xx) / total_requests

SLO_violacion = SLI_availability < 0.999 durante 5 minutos consecutivos
              O SLI_availability < 0.999 en ventana de 1 hora rolling
```

**Fuentes de datos:** Access logs (Express/Vercel), métricas de load balancer.

### SLO-2: Latencia

| Campo | Valor |
|---|---|
| **SLI** | Percentil de latencia de respuesta (time-to-first-byte) |
| **SLO** | P50 < 200ms, P99 < 2000ms |
| **Periodo** | Rolling 7 dias |
| **Error budget** | N/A - se evalua como percentil, no como fraccion |
| **Medicion** | Histograma de latencia por endpoint |

**Calculo:**

```
SLI_latency_p50 = percentile(latencies, 50) < 200ms
SLI_latency_p99 = percentile(latencies, 99) < 2000ms

SLO_violacion = SLI_latency_p50 > 200ms por > 15 minutos en ventana de 1 hora
             O SLI_latency_p99 > 2000ms por > 5 minutos en ventana de 1 hora
```

**Exclusiones:** Cold starts de Vercel (primer request tras 5+ min inactividad).
Endpoints de streaming miden tiempo hasta primer chunk, no cierre completo.

### SLO-3: Tasa de error

| Campo | Valor |
|---|---|
| **SLI** | Fraccion de requests con HTTP 5xx sobre total de requests |
| **SLO** | < 0.1% de requests |
| **Periodo** | Rolling 1 hora (alertas) + mensual (reportes) |
| **Error budget** | 43.8 minutos de errores por mes |
| **Medicion** | Contador de HTTP 5xx / total requests |

**Calculo:**

```
SLI_error_rate = http_5xx_count / total_requests

SLO_violacion = SLI_error_rate > 0.001 por > 5 minutos en ventana de 1 hora
```

**Exclusiones:** HTTP 429 (rate limiting) no cuenta como error.
HTTP 400 por validacion de contrato tampoco cuenta.

### SLO-4: Durabilidad de datos

| Campo | Valor |
|---|---|
| **SLI** | Fraccion de writes exitosos con confirmacion persistida |
| **SLO** | 99.999% (cinco nueves) |
| **Periodo** | Rolling 30 dias |
| **Error budget** | 26 segundos de perdida de datos por mes |
| **Medicion** | Verificacion de checksum post-write |

**Calculo:**

```
SLI_durability = writes_confirmed / total_writes

SLO_violacion = SLI_durability < 0.99999 en ventana de 24 horas
```

**Alcance:** Aplica a SQLite (WAL + fsync) y futuro PostgreSQL (WAL archiving).
No aplica a estado en memoria (memory store, audit log in-memory).

### SLO-5: Integridad del ledger de evidencia (BookPI)

| Campo | Valor |
|---|---|
| **SLI** | Fraccion de entradas del ledger que pasan verificacion de cadena hash |
| **SLO** | 100% - verificacion completa de cadena |
| **Periodo** | Cada escritura + verificacion nocturna |
| **Error budget** | 0 tolerancia - cualquier fallo es incidente SEV-1 |
| **Medicion** | `verifyLedger()` en `bookpi.server.ts` |

**Calculo:**

```
SLI_ledger_integrity = entries_valid / total_entries

SLO_violacion = SLI_ledger_integrity < 1.0 (cualquier entrada corrupta)
```

**Respuesta:** Cualquier violacion de SLO-5 activa SEV-1 automatico.
No hay error budget para integridad de evidencia forense.

### SLO-6: Freshness de memoria

| Campo | Valor |
|---|---|
| **SLI** | Edad maxima de la entrada de memoria mas reciente antes de ser servida |
| **SLO** | < 5000ms desde persistencia hasta disponibilidad en query |
| **Periodo** | Rolling 1 hora |
| **Error budget** | N/A - metrica continua |
| **Medicion** | Timestamp de persistencia vs timestamp de primera query exitosa |

**Calculo:**

```
SLI_memory_freshness = max(query_timestamp - persist_timestamp) < 5000ms

SLO_violacion = SLI_memory_freshness > 5000ms por > 10% de queries en 1 hora
```

## 3. Violacion de SLO - Definicion formal

Un SLO se considera **violado** cuando:

1. **Breach sostenido:** El SLI esta fuera de rango por mas de la ventana de gracia
   definida para ese SLO (ver tabla abajo).
2. **Breach acumulado:** El error budget se agota antes del fin del periodo de
   evaluacion.
3. **Breach catastrofico:** SLO-5 (integridad del ledger) tiene breach en cualquier
   cantidad.

| SLO | Ventana de gracia | Evaluacion |
|---|---|---|
| SLO-1: Disponibilidad | 5 minutos | Rolling 1 hora + mensual |
| SLO-2: Latencia P50 | 15 minutos | Rolling 1 hora |
| SLO-2: Latencia P99 | 5 minutos | Rolling 1 hora |
| SLO-3: Error rate | 5 minutos | Rolling 1 hora + mensual |
| SLO-4: Durabilidad | 1 hora | Rolling 24 horas |
| SLO-5: Ledger integrity | 0 (inmediato) | Cada escritura |
| SLO-6: Memory freshness | 10 minutos | Rolling 1 hora |

## 4. Escalamiento por violacion

| Nivel | SLOs afectados | Accion | Responsable | SLA respuesta |
|---|---|---|---|---|
| **Critico** | SLO-5 | Kill-switch + investigacion inmediata | Operador + Lead | 15 minutos |
| **Alto** | SLO-1, SLO-3 | Page on-call, mitigacion activa | Operador | 30 minutos |
| **Medio** | SLO-2, SLO-4, SLO-6 | Ticket, investigacion en horario | Dev team | 4 horas |
| **Bajo** | Error budget agotado sin breach activo | Review en proximo sprint | Tech lead | Siguiente sprint |

## 5. Error budget policy

### Consumo normal

- Si el error budget esta al 50% o mas: deploy normal permitido.
- Si el error budget esta entre 25% y 50%: solo hotfixes y cambios de baja riesgo.
- Si el error budget esta por debajo de 25%: congelar features, solo estabilidad.
- Si el error budget se agota: **congelar todos los deploys** hasta el proximo periodo.

### Calculo mensual

```
Error budget (minutos) = (1 - SLO_target) * period_minutes
SLO-1: (1 - 0.999) * 43200 = 43.2 minutos
SLO-3: (1 - 0.001) * total_requests * avg_latency = tolerancia
```

## 6. Dashboard y reportes

### Dashboard en tiempo real

| Panel | SLI mostrado | Color |
|---|---|---|
| Disponibilidad | `SLI_availability` (ultima hora) | Verde > 99.95%, Amarillo > 99.9%, Rojo < 99.9% |
| Latencia P50 | `latency_p50` (ultima hora) | Verde < 200ms, Amarillo < 300ms, Rojo > 300ms |
| Latencia P99 | `latency_p99` (ultima hora) | Verde < 2s, Amarillo < 3s, Rojo > 3s |
| Error rate | `SLI_error_rate` (ultima hora) | Verde < 0.05%, Amarillo < 0.1%, Rojo > 0.1% |
| Ledger integrity | `SLI_ledger_integrity` | Verde = 1.0, Rojo < 1.0 |
| Error budget restante | `% budget remaining` | Verde > 50%, Amarillo > 25%, Rojo < 25% |

### Reporte mensual

Generado automaticamente al cierre de periodo:

1. SLI promedio por cada SLO.
2. Minutos de breach por SLO.
3. Error budget consumido vs restante.
4. Top 5 incidentes del mes.
5. Comparativa con mes anterior.
6. Recomendaciones para el proximo periodo.

## 7. Implementacion actual vs objetivo

| SLO | Estado actual | Objetivo |
|---|---|---|
| SLO-1: Disponibilidad | Sin medicion formal | Vercel analytics + custom counters |
| SLO-2: Latencia | Sin medicion formal | OpenTelemetry histograms |
| SLO-3: Error rate | Sin medicion formal | Contadores por status code |
| SLO-4: Durabilidad | SQLite WAL activo | WAL + fsync + verificacion |
| SLO-5: Ledger integrity | `verifyLedger()` implementado | Monitoreo automatico nocturno |
| SLO-6: Memory freshness | Sin medicion formal | Timestamp tracking |

## 8. Notas

- Los SLOs son internos. El SLA externo (si se define) debe ser estrictamente
  menos exigente que los SLOs internos.
- Los valores actuales sonobjetivos de diseno. Se ajustaran con datos reales
  despues de 30 dias de operacion continua.
- Los cold starts de Vercel se excluyen de SLO-2 unicamente durante los primeros
  6 meses o hasta que se migre a infraestructura persistente.
