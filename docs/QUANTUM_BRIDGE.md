# Isabella Quantum Bridge — Arquitectura Gobernada PQC, TEE, HSM y PennyLane

> Documento técnico consolidado para integrar Isabella, Yun, ARGUS, el Heptafederado, BookPI y un sidecar Python gobernado para PennyLane.
>
> **Estado:** propuesta de arquitectura y referencia de implementación.
>
> **Advertencia:** `default.qubit`, `lightning.qubit` y `qiskit.aer` son simuladores o backends de software. El sistema debe etiquetarlos explícitamente y nunca afirmar ejecución en hardware cuántico cuando no exista un proveedor físico configurado.

## 1. Objetivos

- Exponer una API gobernada para ejecutar circuitos declarativos con PennyLane.
- Evitar que Node importe paquetes Python directamente.
- Evitar que el frontend ejecute Python o conozca secretos de infraestructura.
- Aplicar autorización por tenant, sujeto, rol y scopes.
- Limitar wires, gates, shots, duración, tamaño de payload y profundidad del circuito.
- Ejecutar mediante un pool controlado de workers Python persistentes.
- Aplicar backpressure y reemplazo automático de workers muertos.
- Implementar timeout, cancelación, circuit breaker, idempotencia y fallback honesto.
- Registrar cada ejecución en telemetría estructurada y BookPI.
- Enlazar la ejecución con CRYSTALS-LATAMV como cadena de auditoría interna.
- Integrar el resultado con Yun y el Heptafederado sin conceder autoridad implícita a un agente.
- Preparar puntos de integración con HSM, TEE, WebAuthn, PostgreSQL y respaldo distribuido.

## 2. Principios de seguridad

### 2.1 Separación de dominios

El frontend solo solicita una operación. Node valida y gobierna. El worker ejecuta. BookPI audita. El HSM custodia claves. El TEE protege una carga concreta cuando exista un runtime de atestación verificable.

### 2.2 No se ejecuta código arbitrario

El contrato acepta un circuito declarativo compuesto por una lista permitida de gates y measurements. No se acepta código Python, expresiones lambda, imports, nombres de módulos ni archivos enviados por el usuario.

### 2.3 Fallback honesto

Si PennyLane, Lightning o Qiskit no están instalados, el bridge responde:

```json
{
  "status": "degraded",
  "implementation": "CLASSICAL_FALLBACK_NOT_QUANTUM"
}
```

El fallback puede producir una estimación clásica únicamente si está explícitamente implementado y etiquetado como tal. Nunca debe reutilizar `PENNYLANE_SIMULATOR` cuando PennyLane no ejecutó.

### 2.4 Idempotencia

Cada solicitud usa un `requestId` UUID. La clave lógica de idempotencia es:

```text
<tenantId>:<requestId>
```

Una repetición devuelve el mismo resultado previamente persistido, evitando duplicar trabajo, auditoría o cargos.

### 2.5 Confianza limitada en TEE

Un TEE no elimina la necesidad de validación externa. La atestación debe verificarse contra una raíz de confianza, una política de imagen, una medición de código y una fecha de validez. Un resultado de TEE sin verificación no debe considerarse confiable.

## 3. Arquitectura lógica

```text
┌──────────────────────────────────────────────────────────────────┐
│ Isabella UI / Cattleya / Yun                                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS + WebAuthn session
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Gateway                                                     │
│ - autenticación                                                 │
│ - tenant isolation                                               │
│ - scopes                                                         │
│ - rate limit                                                     │
│ - schema validation                                              │
│ - request size limits                                            │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ ARGUS Quantum Policy                                            │
│ - quantum:execute                                               │
│ - quantum:lightning                                             │
│ - quantum:qiskit                                                │
│ - limits por rol y tenant                                       │
│ - decisión allow/deny/degraded                                  │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Quantum Service                                                 │
│ - idempotency                                                    │
│ - circuit hash                                                   │
│ - queue admission                                                │
│ - timeout                                                        │
│ - circuit breaker                                                │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Worker Pool                                                      │
│ - N procesos Python                                              │
│ - bounded queue                                                  │
│ - worker replacement                                             │
│ - SIGKILL ante timeout                                           │
└───────────────────────────────┬──────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ PennyLane Sidecar                                               │
│ - default.qubit                                                  │
│ - lightning.qubit                                                │
│ - qiskit.aer opcional                                            │
└───────────────┬──────────────────────┬───────────────────────────┘
                │                      │
                ▼                      ▼
         BookPI audit           TEE / HSM service
                │                      │
                ▼                      ▼
       Heptafederado         PostgreSQL + backups
```

## 4. Flujo de una ejecución

1. El usuario o Yun solicita una ejecución con `requestId` único.
2. El gateway autentica la sesión y obtiene el principal.
3. ARGUS comprueba tenant, role, scopes y límites.
4. Zod valida el circuito declarativo.
5. Se calcula el hash canónico del request.
6. Se consulta el almacén de idempotencia.
7. Si el request ya existe, se devuelve el resultado anterior.
8. Si la cola está llena, se devuelve `QUANTUM_QUEUE_FULL` sin aceptar trabajo adicional.
9. El pool asigna un worker libre.
10. El sidecar carga el proveedor solicitado.
11. PennyLane ejecuta el circuito con el modo y shots permitidos.
12. El worker devuelve JSON delimitado por salto de línea.
13. Node añade telemetría, workerId y hash.
14. BookPI enlaza el evento con el bloque previo.
15. PostgreSQL guarda el evento y su estado.
16. El Heptafederado replica el evento firmado o su digest.
17. El cliente recibe el resultado y su clasificación de implementación.

## 5. Estructura recomendada

```text
src/
├── api/
│   └── quantum/
│       └── pennylane.ts
├── quantum/
│   ├── argusPolicy.ts
│   ├── circuitHash.ts
│   ├── contracts.ts
│   ├── quantumAudit.ts
│   ├── quantumRuntime.ts
│   ├── quantumService.ts
│   ├── workerPool.ts
│   ├── teeVerifier.ts
│   ├── quantumRepository.ts
│   └── __tests__/
│       ├── quantumPolicy.test.ts
│       ├── quantumService.test.ts
│       └── workerPool.test.ts
├── security/
│   ├── webAuthn.ts
│   ├── hsmClient.ts
│   └── keyPolicy.ts
└── db/
    ├── pool.ts
    └── migrations/
        └── 001_quantum.sql
scripts/
└── quantum/
    ├── pennylane_bridge.py
    └── requirements.txt
```

## 6. Contratos TypeScript

Archivo: `src/quantum/contracts.ts`

```ts
import { z } from "zod";

export const QuantumProviderSchema = z.enum([
  "default.qubit",
  "lightning.qubit",
  "qiskit.aer",
]);

export const QuantumExecutionModeSchema = z.enum([
  "analytic",
  "sampled",
]);

const WireSchema = z.number().int().min(0).max(23);

export const QuantumGateSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("H"),
    wires: z.tuple([WireSchema]),
  }),
  z.object({
    name: z.literal("X"),
    wires: z.tuple([WireSchema]),
  }),
  z.object({
    name: z.literal("Y"),
    wires: z.tuple([WireSchema]),
  }),
  z.object({
    name: z.literal("Z"),
    wires: z.tuple([WireSchema]),
  }),
  z.object({
    name: z.literal("RX"),
    wires: z.tuple([WireSchema]),
    params: z.tuple([z.number().finite()]),
  }),
  z.object({
    name: z.literal("RY"),
    wires: z.tuple([WireSchema]),
    params: z.tuple([z.number().finite()]),
  }),
  z.object({
    name: z.literal("RZ"),
    wires: z.tuple([WireSchema]),
    params: z.tuple([z.number().finite()]),
  }),
  z.object({
    name: z.literal("CNOT"),
    wires: z.tuple([WireSchema, WireSchema]),
  }),
]);

export const QuantumMeasurementSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("expval"),
    observable: z.enum(["PauliX", "PauliY", "PauliZ"]),
    wire: WireSchema,
  }),
  z.object({
    name: z.literal("probs"),
    wires: z.array(WireSchema).min(1).max(24),
  }),
  z.object({
    name: z.literal("sample"),
    wire: WireSchema,
  }),
]);

export const QuantumCircuitSchema = z
  .object({
    wires: z.number().int().min(1).max(24),
    gates: z.array(QuantumGateSchema).min(1).max(256),
    measurements: z.array(QuantumMeasurementSchema).min(1).max(8),
  })
  .superRefine((circuit, ctx) => {
    const maxWire = circuit.wires - 1;

    circuit.gates.forEach((gate, index) => {
      gate.wires.forEach((wire) => {
        if (wire > maxWire) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["gates", index, "wires"],
            message: `Wire ${wire} is outside the circuit range`,
          });
        }
      });
    });

    circuit.measurements.forEach((measurement, index) => {
      const wires =
        measurement.name === "probs"
          ? measurement.wires
          : [measurement.wire];

      wires.forEach((wire) => {
        if (wire > maxWire) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["measurements", index],
            message: `Measurement wire ${wire} is outside the circuit range`,
          });
        }
      });
    });
  });

export const QuantumExecutionRequestSchema = z.object({
  requestId: z.string().uuid(),
  tenantId: z.string().min(1).max(128),
  provider: QuantumProviderSchema.default("default.qubit"),
  mode: QuantumExecutionModeSchema.default("analytic"),
  wires: z.number().int().min(1).max(24),
  shots: z.number().int().min(1).max(100_000).nullable().default(null),
  circuit: QuantumCircuitSchema,
  metadata: z.record(z.string().max(256)).optional().default({}),
});

export type QuantumProvider = z.infer<typeof QuantumProviderSchema>;
export type QuantumExecutionMode = z.infer<typeof QuantumExecutionModeSchema>;
export type QuantumExecutionRequest = z.infer<
  typeof QuantumExecutionRequestSchema
>;

export interface QuantumExecutionResult {
  requestId: string;
  status: "completed" | "degraded" | "rejected" | "failed";
  implementation:
    | "PENNYLANE_SIMULATOR"
    | "PENNYLANE_LIGHTNING"
    | "PENNYLANE_QISKIT"
    | "CLASSICAL_FALLBACK_NOT_QUANTUM";
  provider: QuantumProvider;
  mode: QuantumExecutionMode;
  result?: unknown;
  telemetry: {
    durationMs: number;
    queueWaitMs: number;
    workerId?: string;
    shots: number | null;
    wires: number;
    gates?: number;
  };
  audit: {
    policyDecision: "allow" | "deny" | "degraded";
    circuitHash: string;
    bookpiBlockHash?: string;
    teeVerified?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}
```

## 7. Política ARGUS

Archivo: `src/quantum/argusPolicy.ts`

```ts
import type {
  QuantumExecutionRequest,
  QuantumProvider,
} from "./contracts";

export interface QuantumPrincipal {
  subject: string;
  tenantId: string;
  scopes: string[];
  role: "user" | "agent" | "operator" | "service";
}

export interface QuantumPolicyDecision {
  decision: "allow" | "deny" | "degraded";
  reason: string;
  normalizedProvider: QuantumProvider;
  maxTimeoutMs: number;
  maxWorkersCost: number;
}

const PROVIDER_SCOPE: Record<QuantumProvider, string | null> = {
  "default.qubit": null,
  "lightning.qubit": "quantum:lightning",
  "qiskit.aer": "quantum:qiskit",
};

const ROLE_LIMITS = {
  user: { maxWires: 12, maxGates: 64, maxShots: 10_000 },
  agent: { maxWires: 16, maxGates: 128, maxShots: 20_000 },
  operator: { maxWires: 24, maxGates: 256, maxShots: 100_000 },
  service: { maxWires: 24, maxGates: 256, maxShots: 100_000 },
} as const;

export function evaluateQuantumPolicy(
  principal: QuantumPrincipal,
  request: QuantumExecutionRequest,
): QuantumPolicyDecision {
  const limits = ROLE_LIMITS[principal.role];

  if (principal.tenantId !== request.tenantId) {
    return deny("TENANT_MISMATCH");
  }

  if (!principal.scopes.includes("quantum:execute")) {
    return deny("MISSING_QUANTUM_EXECUTE_SCOPE");
  }

  if (request.wires > limits.maxWires) {
    return deny("ROLE_WIRES_LIMIT_EXCEEDED");
  }

  if (request.circuit.gates.length > limits.maxGates) {
    return deny("ROLE_GATES_LIMIT_EXCEEDED");
  }

  if (request.shots !== null && request.shots > limits.maxShots) {
    return deny("ROLE_SHOTS_LIMIT_EXCEEDED");
  }

  const requiredScope = PROVIDER_SCOPE[request.provider];

  if (requiredScope && !principal.scopes.includes(requiredScope)) {
    return deny(`MISSING_SCOPE_${requiredScope}`);
  }

  if (request.provider === "qiskit.aer") {
    return {
      decision: "allow",
      reason: "QISKIT_SCOPE_GRANTED",
      normalizedProvider: "qiskit.aer",
      maxTimeoutMs: 20_000,
      maxWorkersCost: 4,
    };
  }

  if (request.provider === "lightning.qubit") {
    return {
      decision: "allow",
      reason: "LIGHTNING_SCOPE_GRANTED",
      normalizedProvider: "lightning.qubit",
      maxTimeoutMs: 10_000,
      maxWorkersCost: 2,
    };
  }

  return {
    decision: "allow",
    reason: "LOCAL_SIMULATOR_ALLOWED",
    normalizedProvider: "default.qubit",
    maxTimeoutMs: 5_000,
    maxWorkersCost: 1,
  };
}

function deny(reason: string): QuantumPolicyDecision {
  return {
    decision: "deny",
    reason,
    normalizedProvider: "default.qubit",
    maxTimeoutMs: 5_000,
    maxWorkersCost: 0,
  };
}
```

## 8. Hash canónico

Archivo: `src/quantum/circuitHash.ts`

```ts
import { createHash } from "node:crypto";
import type { QuantumExecutionRequest } from "./contracts";

export function canonicalizeCircuitRequest(
  request: QuantumExecutionRequest,
): string {
  return JSON.stringify({
    requestId: request.requestId,
    tenantId: request.tenantId,
    provider: request.provider,
    mode: request.mode,
    wires: request.wires,
    shots: request.shots,
    circuit: request.circuit,
  });
}

export function hashCircuitRequest(
  request: QuantumExecutionRequest,
): string {
  return createHash("sha3-512")
    .update(canonicalizeCircuitRequest(request), "utf8")
    .digest("hex");
}
```

## 9. Pool de workers

Archivo: `src/quantum/workerPool.ts`

```ts
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

interface WorkerJob<TRequest, TResult> {
  request: TRequest;
  resolve: (result: TResult) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
  timeoutMs: number;
}

interface WorkerState<TRequest, TResult> {
  id: string;
  process: ChildProcessWithoutNullStreams;
  busy: boolean;
  currentJob?: WorkerJob<TRequest, TResult>;
}

interface WorkerPoolOptions {
  size: number;
  maxQueue: number;
  pythonBin: string;
  scriptPath: string;
  defaultTimeoutMs: number;
  maxLineBytes: number;
}

export class QuantumWorkerPool<TRequest, TResult> {
  private readonly workers: WorkerState<TRequest, TResult>[] = [];
  private readonly queue: WorkerJob<TRequest, TResult>[] = [];
  private draining = false;

  constructor(private readonly options: WorkerPoolOptions) {}

  async start(): Promise<void> {
    if (this.workers.length > 0) return;

    for (let index = 0; index < this.options.size; index += 1) {
      this.workers.push(this.createWorker());
    }
  }

  async stop(): Promise<void> {
    this.draining = true;

    for (const job of this.queue.splice(0)) {
      job.reject(new Error("WORKER_POOL_STOPPED"));
    }

    for (const worker of this.workers) {
      worker.process.kill("SIGTERM");
    }

    this.workers.length = 0;
    this.draining = false;
  }

  async execute(
    request: TRequest,
    timeoutMs = this.options.defaultTimeoutMs,
  ): Promise<TResult> {
    if (this.draining) {
      throw new Error("WORKER_POOL_DRAINING");
    }

    if (this.queue.length >= this.options.maxQueue) {
      throw new Error("QUANTUM_QUEUE_FULL");
    }

    return new Promise<TResult>((resolve, reject) => {
      this.queue.push({
        request,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        timeoutMs,
      });

      this.dispatch();
    });
  }

  getStatus() {
    return {
      workers: this.workers.map((worker) => ({
        id: worker.id,
        busy: worker.busy,
      })),
      queued: this.queue.length,
      draining: this.draining,
    };
  }

  private createWorker(): WorkerState<TRequest, TResult> {
    const workerId = `quantum-worker-${randomUUID()}`;
    const child = spawn(
      this.options.pythonBin,
      [this.options.scriptPath, "--stdio"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          ISABELLA_QUANTUM_WORKER_ID: workerId,
        },
      },
    );

    const worker: WorkerState<TRequest, TResult> = {
      id: workerId,
      process: child,
      busy: false,
    };

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      console.error("[QUANTUM_WORKER_STDERR]", {
        workerId,
        message: chunk.slice(0, 4_000),
      });
    });

    child.on("exit", (code, signal) => {
      console.warn("[QUANTUM_WORKER_EXIT]", { workerId, code, signal });

      if (worker.currentJob) {
        worker.currentJob.reject(new Error("QUANTUM_WORKER_TERMINATED"));
        worker.currentJob = undefined;
        worker.busy = false;
      }

      const index = this.workers.indexOf(worker);
      if (index >= 0 && !this.draining) {
        this.workers[index] = this.createWorker();
        this.dispatch();
      }
    });

    return worker;
  }

  private dispatch(): void {
    while (this.queue.length > 0) {
      const worker = this.workers.find((candidate) => !candidate.busy);
      if (!worker) return;

      const job = this.queue.shift();
      if (!job) return;

      worker.busy = true;
      worker.currentJob = job;
      void this.runJob(worker, job);
    }
  }

  private async runJob(
    worker: WorkerState<TRequest, TResult>,
    job: WorkerJob<TRequest, TResult>,
  ): Promise<void> {
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      worker.busy = false;
      worker.currentJob = undefined;
      callback();
      this.dispatch();
    };

    const timeout = setTimeout(() => {
      worker.process.kill("SIGKILL");
      settle(() => job.reject(new Error("QUANTUM_EXECUTION_TIMEOUT")));
    }, job.timeoutMs);

    try {
      const result = await this.sendRequest(worker, job.request);
      clearTimeout(timeout);
      settle(() => job.resolve(result));
    } catch (error) {
      clearTimeout(timeout);
      settle(() =>
        job.reject(
          error instanceof Error
            ? error
            : new Error("QUANTUM_WORKER_ERROR"),
        ),
      );
    }
  }

  private sendRequest(
    worker: WorkerState<TRequest, TResult>,
    request: TRequest,
  ): Promise<TResult> {
    return new Promise((resolve, reject) => {
      let output = "";
      let settled = false;

      const cleanup = () => {
        worker.process.stdout.off("data", onStdout);
        worker.process.off("error", onError);
      };

      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const onStdout = (chunk: Buffer | string) => {
        output += chunk.toString();

        if (Buffer.byteLength(output, "utf8") > this.options.maxLineBytes) {
          finish(() => reject(new Error("QUANTUM_RESPONSE_TOO_LARGE")));
          worker.process.kill("SIGKILL");
          return;
        }

        const newlineIndex = output.indexOf("\n");
        if (newlineIndex < 0) return;

        const line = output.slice(0, newlineIndex);
        finish(() => {
          try {
            resolve(JSON.parse(line) as TResult);
          } catch {
            reject(new Error("INVALID_QUANTUM_WORKER_JSON"));
          }
        });
      };

      const onError = (error: Error) => finish(() => reject(error));

      worker.process.stdout.on("data", onStdout);
      worker.process.on("error", onError);

      worker.process.stdin.write(
        `${JSON.stringify(request)}\n`,
        "utf8",
        (error) => {
          if (error) finish(() => reject(error));
        },
      );
    });
  }
}
```

## 10. Servicio cuántico

Archivo: `src/quantum/quantumService.ts`

```ts
import {
  QuantumExecutionRequestSchema,
  type QuantumExecutionRequest,
  type QuantumExecutionResult,
} from "./contracts";
import {
  evaluateQuantumPolicy,
  type QuantumPrincipal,
} from "./argusPolicy";
import { hashCircuitRequest } from "./circuitHash";
import { QuantumWorkerPool } from "./workerPool";

export interface IdempotencyStore {
  get(key: string): Promise<QuantumExecutionResult | null>;
  set(
    key: string,
    value: QuantumExecutionResult,
    ttlSeconds: number,
  ): Promise<void>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly values = new Map<
    string,
    { expiresAt: number; value: QuantumExecutionResult }
  >();

  async get(key: string): Promise<QuantumExecutionResult | null> {
    const entry = this.values.get(key);

    if (!entry || entry.expiresAt < Date.now()) {
      this.values.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(
    key: string,
    value: QuantumExecutionResult,
    ttlSeconds: number,
  ): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1_000,
    });
  }
}

export class QuantumService {
  constructor(
    private readonly pool: QuantumWorkerPool<
      QuantumExecutionRequest,
      QuantumExecutionResult
    >,
    private readonly idempotency: IdempotencyStore =
      new MemoryIdempotencyStore(),
  ) {}

  async initialize(): Promise<void> {
    await this.pool.start();
  }

  async shutdown(): Promise<void> {
    await this.pool.stop();
  }

  async execute(
    principal: QuantumPrincipal,
    input: unknown,
  ): Promise<QuantumExecutionResult> {
    const request = QuantumExecutionRequestSchema.parse(input);
    const idempotencyKey = `${principal.tenantId}:${request.requestId}`;
    const circuitHash = hashCircuitRequest(request);

    const previous = await this.idempotency.get(idempotencyKey);
    if (previous) return previous;

    const policy = evaluateQuantumPolicy(principal, request);

    if (policy.decision === "deny") {
      const rejected: QuantumExecutionResult = {
        requestId: request.requestId,
        status: "rejected",
        implementation: "CLASSICAL_FALLBACK_NOT_QUANTUM",
        provider: request.provider,
        mode: request.mode,
        telemetry: {
          durationMs: 0,
          queueWaitMs: 0,
          shots: request.shots,
          wires: request.wires,
          gates: request.circuit.gates.length,
        },
        audit: {
          policyDecision: "deny",
          circuitHash,
        },
        error: {
          code: "QUANTUM_POLICY_DENIED",
          message: policy.reason,
        },
      };

      await this.idempotency.set(idempotencyKey, rejected, 300);
      return rejected;
    }

    const startedAt = Date.now();

    try {
      const result = await this.pool.execute(
        request,
        policy.maxTimeoutMs,
      );

      result.telemetry.durationMs = Date.now() - startedAt;
      result.telemetry.gates = request.circuit.gates.length;
      result.audit.circuitHash = circuitHash;

      await this.idempotency.set(idempotencyKey, result, 900);
      return result;
    } catch (error) {
      const degraded: QuantumExecutionResult = {
        requestId: request.requestId,
        status: "degraded",
        implementation: "CLASSICAL_FALLBACK_NOT_QUANTUM",
        provider: request.provider,
        mode: request.mode,
        telemetry: {
          durationMs: Date.now() - startedAt,
          queueWaitMs: 0,
          shots: request.shots,
          wires: request.wires,
          gates: request.circuit.gates.length,
        },
        audit: {
          policyDecision: "degraded",
          circuitHash,
        },
        error: {
          code: "QUANTUM_EXECUTION_UNAVAILABLE",
          message:
            error instanceof Error
              ? error.message
              : "Quantum worker unavailable",
        },
      };

      await this.idempotency.set(idempotencyKey, degraded, 30);
      return degraded;
    }
  }

  getStatus() {
    return this.pool.getStatus();
  }
}
```

## 11. Runtime global

Archivo: `src/quantum/quantumRuntime.ts`

```ts
import path from "node:path";
import { QuantumService } from "./quantumService";
import { QuantumWorkerPool } from "./workerPool";
import type {
  QuantumExecutionRequest,
  QuantumExecutionResult,
} from "./contracts";

const globalForQuantum = globalThis as typeof globalThis & {
  quantumService?: QuantumService;
};

export const quantumService =
  globalForQuantum.quantumService ??
  new QuantumService(
    new QuantumWorkerPool<
      QuantumExecutionRequest,
      QuantumExecutionResult
    >({
      size: Number(process.env.QUANTUM_WORKERS ?? 2),
      maxQueue: Number(process.env.QUANTUM_MAX_QUEUE ?? 32),
      pythonBin: process.env.PYTHON_BIN ?? "python3",
      scriptPath: path.resolve(
        process.cwd(),
        "scripts/quantum/pennylane_bridge.py",
      ),
      defaultTimeoutMs: Number(
        process.env.QUANTUM_TIMEOUT_MS ?? 15_000,
      ),
      maxLineBytes: Number(
        process.env.QUANTUM_MAX_RESPONSE_BYTES ?? 2_000_000,
      ),
    }),
  );

if (process.env.NODE_ENV !== "production") {
  globalForQuantum.quantumService = quantumService;
}
```

## 12. Sidecar Python

Archivo: `scripts/quantum/pennylane_bridge.py`

```python
#!/usr/bin/env python3

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
import time
from typing import Any

MAX_WIRES = 24
MAX_GATES = 256
MAX_MEASUREMENTS = 8
MAX_SHOTS = 100_000


def make_response(
    request_id: str,
    status: str,
    implementation: str,
    provider: str,
    mode: str,
    started_at: float,
    wires: int,
    shots: int | None,
    result: Any = None,
    error: dict[str, str] | None = None,
) -> dict[str, Any]:
    payload = {
        "requestId": request_id,
        "status": status,
        "implementation": implementation,
        "provider": provider,
        "mode": mode,
        "result": result,
        "telemetry": {
            "durationMs": round((time.perf_counter() - started_at) * 1000, 3),
            "queueWaitMs": 0,
            "shots": shots,
            "wires": wires,
        },
        "audit": {
            "policyDecision": "allow" if status == "completed" else "degraded",
            "circuitHash": "",
        },
    }

    if error:
        payload["error"] = error

    return payload


def validate_request(request: dict[str, Any]) -> None:
    circuit = request["circuit"]
    wires = request["wires"]
    gates = circuit["gates"]
    measurements = circuit["measurements"]
    shots = request.get("shots")

    if wires < 1 or wires > MAX_WIRES:
        raise ValueError("WIRES_LIMIT_EXCEEDED")

    if len(gates) < 1 or len(gates) > MAX_GATES:
        raise ValueError("GATES_LIMIT_EXCEEDED")

    if len(measurements) < 1 or len(measurements) > MAX_MEASUREMENTS:
        raise ValueError("MEASUREMENTS_LIMIT_EXCEEDED")

    if shots is not None and (shots < 1 or shots > MAX_SHOTS):
        raise ValueError("SHOTS_LIMIT_EXCEEDED")

    if circuit["wires"] != wires:
        raise ValueError("CIRCUIT_WIRES_MISMATCH")

    for gate in gates:
        for wire in gate["wires"]:
            if wire < 0 or wire >= wires:
                raise ValueError("INVALID_WIRE")

        if gate["name"] in {"RX", "RY", "RZ"}:
            parameter = gate["params"][0]
            if not math.isfinite(parameter):
                raise ValueError("INVALID_GATE_PARAMETER")

    for measurement in measurements:
        measurement_wires = (
            measurement["wires"]
            if measurement["name"] == "probs"
            else [measurement["wire"]]
        )

        for wire in measurement_wires:
            if wire < 0 or wire >= wires:
                raise ValueError("INVALID_MEASUREMENT_WIRE")


def load_pennylane(provider: str):
    if importlib.util.find_spec("pennylane") is None:
        return None

    import pennylane as qml

    if provider == "default.qubit":
        return qml

    if provider == "lightning.qubit":
        if importlib.util.find_spec("pennylane_lightning") is None:
            return None
        return qml

    if provider == "qiskit.aer":
        if importlib.util.find_spec("pennylane_qiskit") is None:
            return None
        return qml

    return None


def apply_gate(qml, gate: dict[str, Any]) -> None:
    name = gate["name"]
    wires = gate["wires"]
    params = gate.get("params", [])

    operations = {
        "H": lambda: qml.Hadamard(wires=wires[0]),
        "X": lambda: qml.PauliX(wires=wires[0]),
        "Y": lambda: qml.PauliY(wires=wires[0]),
        "Z": lambda: qml.PauliZ(wires=wires[0]),
        "RX": lambda: qml.RX(params[0], wires=wires[0]),
        "RY": lambda: qml.RY(params[0], wires=wires[0]),
        "RZ": lambda: qml.RZ(params[0], wires=wires[0]),
        "CNOT": lambda: qml.CNOT(wires=wires),
    }

    operation = operations.get(name)
    if operation is None:
        raise ValueError(f"UNSUPPORTED_GATE:{name}")

    operation()


def create_measurement(qml, measurement: dict[str, Any]):
    name = measurement["name"]

    if name == "probs":
        return qml.probs(wires=measurement["wires"])

    if name == "sample":
        return qml.sample(wires=measurement["wire"])

    observable = measurement["observable"]
    wire = measurement["wire"]

    observables = {
        "PauliX": qml.PauliX,
        "PauliY": qml.PauliY,
        "PauliZ": qml.PauliZ,
    }

    return qml.expval(observables[observable](wire))


def execute_quantum(request: dict[str, Any]) -> dict[str, Any]:
    started_at = time.perf_counter()
    request_id = request["requestId"]
    provider = request["provider"]
    mode = request["mode"]
    wires = request["wires"]
    shots = request.get("shots")
    circuit = request["circuit"]

    validate_request(request)

    qml = load_pennylane(provider)

    if qml is None:
        return make_response(
            request_id,
            "degraded",
            "CLASSICAL_FALLBACK_NOT_QUANTUM",
            provider,
            mode,
            started_at,
            wires,
            shots,
            error={
                "code": "PROVIDER_UNAVAILABLE",
                "message": "Requested PennyLane provider is not available",
            },
        )

    if mode == "analytic":
        shots = None

    dev = qml.device(
        provider,
        wires=wires,
        shots=shots,
    )

    @qml.qnode(dev)
    def circuit_fn():
        for gate in circuit["gates"]:
            apply_gate(qml, gate)

        return tuple(
            create_measurement(qml, measurement)
            for measurement in circuit["measurements"]
        )

    result = circuit_fn()

    return make_response(
        request_id,
        "completed",
        {
            "default.qubit": "PENNYLANE_SIMULATOR",
            "lightning.qubit": "PENNYLANE_LIGHTNING",
            "qiskit.aer": "PENNYLANE_QISKIT",
        }[provider],
        provider,
        mode,
        started_at,
        wires,
        shots,
        result=to_json_safe(result),
    )


def to_json_safe(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return value.tolist()

    if isinstance(value, tuple):
        return [to_json_safe(item) for item in value]

    if isinstance(value, list):
        return [to_json_safe(item) for item in value]

    if isinstance(value, float) and not math.isfinite(value):
        return None

    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stdio", action="store_true")
    args = parser.parse_args()

    if not args.stdio:
        print("stdio mode required", file=sys.stderr)
        return 2

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        request_id = "unknown"

        try:
            request = json.loads(line)
            request_id = request.get("requestId", "unknown")
            result = execute_quantum(request)
        except Exception as exc:
            result = {
                "requestId": request_id,
                "status": "failed",
                "implementation": "CLASSICAL_FALLBACK_NOT_QUANTUM",
                "provider": "default.qubit",
                "mode": "analytic",
                "telemetry": {
                    "durationMs": 0,
                    "queueWaitMs": 0,
                    "shots": None,
                    "wires": 0,
                },
                "audit": {
                    "policyDecision": "deny",
                    "circuitHash": "",
                },
                "error": {
                    "code": "BRIDGE_EXECUTION_ERROR",
                    "message": str(exc)[:500],
                },
            }

        sys.stdout.write(json.dumps(result, separators=(",", ":")) + "\n")
        sys.stdout.flush()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

## 13. Configuración Python

Archivo: `scripts/quantum/requirements.txt`

```txt
pennylane
pennylane-lightning
```

Instalación opcional de Qiskit:

```bash
python3 -m pip install pennylane-qiskit
```

Entorno recomendado:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r scripts/quantum/requirements.txt
```

## 14. Endpoint Express

Archivo: `src/api/quantum/pennylane.ts`

```ts
import type { Request, Response, NextFunction } from "express";
import { quantumService } from "../../quantum/quantumRuntime";
import type { QuantumPrincipal } from "../../quantum/argusPolicy";

function getPrincipal(req: Request): QuantumPrincipal {
  const principal = req.auth as Partial<QuantumPrincipal> | undefined;

  if (!principal?.subject || !principal.tenantId) {
    throw new Error("AUTHENTICATED_PRINCIPAL_REQUIRED");
  }

  return {
    subject: principal.subject,
    tenantId: principal.tenantId,
    scopes: principal.scopes ?? [],
    role: principal.role ?? "user",
  };
}

export async function executePennyLane(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const principal = getPrincipal(req);
    const result = await quantumService.execute(principal, req.body);

    const statusCode =
      result.status === "rejected"
        ? 403
        : result.status === "failed"
          ? 500
          : 200;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Quantum-Implementation", result.implementation);
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
}
```

Registro:

```ts
import express from "express";
import { executePennyLane } from "./api/quantum/pennylane";

const router = express.Router();

router.post(
  "/api/v1/quantum/pennylane/execute",
  express.json({ limit: "64kb" }),
  executePennyLane,
);

export default router;
```

## 15. BookPI y CRYSTALS-LATAMV

Archivo: `src/quantum/quantumAudit.ts`

```ts
import { createHash } from "node:crypto";
import type {
  QuantumExecutionRequest,
  QuantumExecutionResult,
} from "./contracts";

export interface BookPIBlock {
  version: "bookpi-quantum-v1";
  blockHash: string;
  previousHash: string;
  eventType: "QUANTUM_EXECUTION";
  requestId: string;
  tenantId: string;
  provider: string;
  implementation: string;
  status: string;
  circuitHash: string;
  timestamp: string;
}

export function createQuantumBookPIBlock(
  request: QuantumExecutionRequest,
  result: QuantumExecutionResult,
  previousHash = "0".repeat(128),
): BookPIBlock {
  const timestamp = new Date().toISOString();

  const canonical = JSON.stringify({
    previousHash,
    requestId: request.requestId,
    tenantId: request.tenantId,
    provider: result.provider,
    implementation: result.implementation,
    status: result.status,
    circuitHash: result.audit.circuitHash,
    timestamp,
  });

  const blockHash = createHash("sha3-512")
    .update(canonical)
    .digest("hex");

  return {
    version: "bookpi-quantum-v1",
    blockHash,
    previousHash,
    eventType: "QUANTUM_EXECUTION",
    requestId: request.requestId,
    tenantId: request.tenantId,
    provider: result.provider,
    implementation: result.implementation,
    status: result.status,
    circuitHash: result.audit.circuitHash,
    timestamp,
  };
}
```

### Uso de CRYSTALS-LATAMV

CRYSTALS-LATAMV debe tratarse como un protocolo interno en desarrollo, no como reemplazo de ML-DSA, SHA3, TLS, WebAuthn o una PKI formal. El diseño recomendado es:

- Cada bloque contiene `previousHash`.
- Cada evento incluye `circuitHash`.
- El bloque se firma con una clave de servicio custodiada en HSM.
- Los nodos federados validan el bloque antes de aceptarlo.
- La cadena se persiste en PostgreSQL en modo append-only.
- Un bloque confirmado no se modifica; las correcciones se expresan como eventos compensatorios.
- La replicación conserva el tenant, el origen, la versión y la política aplicada.

## 16. PostgreSQL

Archivo: `src/db/pool.ts`

```ts
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  quantumPool?: Pool;
};

export const quantumPool =
  globalForDb.quantumPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    query_timeout: 15_000,
    application_name: "isabella-quantum-bridge",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.quantumPool = quantumPool;
}

export async function closeQuantumPool(): Promise<void> {
  await quantumPool.end();
}
```

En funciones serverless se recomienda usar una cadena de conexión con pooler o un proveedor compatible con el patrón de ejecución. No se debe abrir un pool grande por cada invocación. En despliegues persistentes, el tamaño debe calcularse considerando el número de réplicas, workers y conexiones disponibles en PostgreSQL.

Archivo: `src/db/migrations/001_quantum.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS quantum_execution (
  request_id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  implementation TEXT NOT NULL,
  status TEXT NOT NULL,
  circuit_hash CHAR(128) NOT NULL,
  result_json JSONB,
  telemetry_json JSONB NOT NULL,
  audit_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS quantum_execution_tenant_created_idx
  ON quantum_execution (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quantum_execution_circuit_hash_idx
  ON quantum_execution (circuit_hash);

CREATE TABLE IF NOT EXISTS bookpi_quantum_block (
  block_hash CHAR(128) PRIMARY KEY,
  previous_hash CHAR(128) NOT NULL,
  request_id UUID NOT NULL REFERENCES quantum_execution(request_id),
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  signature TEXT,
  signer_key_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookpi_quantum_tenant_created_idx
  ON bookpi_quantum_block (tenant_id, created_at DESC);
```

## 17. Persistencia transaccional

Archivo: `src/quantum/quantumRepository.ts`

```ts
import type { PoolClient } from "pg";
import { quantumPool } from "../db/pool";
import type {
  QuantumExecutionRequest,
  QuantumExecutionResult,
} from "./contracts";
import type { BookPIBlock } from "./quantumAudit";

export async function persistQuantumExecution(
  request: QuantumExecutionRequest,
  result: QuantumExecutionResult,
  block: BookPIBlock,
  subjectId: string,
): Promise<void> {
  const client = await quantumPool.connect();

  try {
    await client.query("BEGIN");

    await insertExecution(client, request, result, subjectId);

    await client.query(
      `
      INSERT INTO bookpi_quantum_block (
        block_hash,
        previous_hash,
        request_id,
        tenant_id,
        event_type,
        payload_json
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (block_hash) DO NOTHING
      `,
      [
        block.blockHash,
        block.previousHash,
        request.requestId,
        request.tenantId,
        block.eventType,
        JSON.stringify(block),
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertExecution(
  client: PoolClient,
  request: QuantumExecutionRequest,
  result: QuantumExecutionResult,
  subjectId: string,
): Promise<void> {
  await client.query(
    `
    INSERT INTO quantum_execution (
      request_id,
      tenant_id,
      subject_id,
      provider,
      mode,
      implementation,
      status,
      circuit_hash,
      result_json,
      telemetry_json,
      audit_json,
      completed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
    ON CONFLICT (request_id) DO NOTHING
    `,
    [
      request.requestId,
      request.tenantId,
      subjectId,
      result.provider,
      result.mode,
      result.implementation,
      result.status,
      result.audit.circuitHash,
      result.result ? JSON.stringify(result.result) : null,
      JSON.stringify(result.telemetry),
      JSON.stringify(result.audit),
    ],
  );
}
```

## 18. HSM y firma del evento

La firma PQC del resultado debe realizarse en servidor, nunca en React. Una integración real puede exponer una interfaz como:

```ts
export interface SigningProvider {
  sign(payload: Uint8Array, keyId: string): Promise<Uint8Array>;
  verify(
    payload: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): Promise<boolean>;
}
```

Reglas de custodia:

- La clave privada no se guarda en PostgreSQL.
- La clave privada no se envía al worker Python.
- El frontend no recibe material secreto.
- El HSM firma el digest o payload canónico autorizado.
- El key ID y la versión de política sí se registran en BookPI.
- Una rotación de clave crea un nuevo `keyVersion`; no reescribe eventos históricos.
- Un HSM primario y uno de respaldo deben tener políticas de clave equivalentes y auditoría independiente.

## 19. TEE

El TEE debe integrarse como un servicio separado:

```ts
export interface TeeVerifier {
  verifyAttestation(input: {
    evidence: string;
    nonce: string;
    expectedImageDigest: string;
    expectedPolicyVersion: string;
  }): Promise<{
    verified: boolean;
    platform: string;
    imageDigest: string;
    expiresAt: string;
    reason?: string;
  }>;
}
```

El flujo seguro es:

1. Node genera un nonce aleatorio.
2. El worker o enclave produce evidencia de atestación.
3. El verificador externo valida firma, nonce, plataforma, imagen y política.
4. Se comprueba expiración y revocación.
5. El resultado se marca `teeVerified: true` solo después de esa validación.
6. Si la atestación no puede verificarse, se responde `degraded` o se rechaza según la sensibilidad del tenant.

No debe usarse una cadena como `TEE_ATTESTATION_<timestamp>` como atestación real. Eso sería únicamente un mock de pruebas.

## 20. WebAuthn

WebAuthn autentica al usuario, pero no sustituye la autorización de ARGUS ni la custodia de claves del HSM. La validación real debe ocurrir en backend con una librería WebAuthn mantenida, verificando:

- `origin`.
- `rpId`.
- challenge de un solo uso.
- firma de assertion.
- contador del autenticador.
- user verification.
- credential ID registrado.
- estado de revocación.

El navegador nunca debe enviar una credencial como si fuera un simple `userId`. El backend genera el challenge y conserva su estado asociado a la sesión.

## 21. Integración con Yun

Yun puede actuar como orquestador cognitivo, pero debe tener un principal explícito:

```json
{
  "subject": "yun-agent-01",
  "tenantId": "tamv-online",
  "role": "agent",
  "scopes": ["quantum:execute"]
}
```

Yun no debe poder:

- Cambiar su propio tenant.
- Añadir `quantum:qiskit`.
- Elevar wires, gates o shots por encima de su rol.
- Enviar Python arbitrario.
- Firmar su propia auditoría.
- Marcar un resultado como cuántico.
- Desactivar idempotencia, límites o telemetría.

Yun sí puede:

- Proponer circuitos declarativos.
- Solicitar una ejecución permitida.
- Recibir el resultado clasificado.
- Asociar la ejecución con una tarea cognitiva.
- Consumir el bloque BookPI después de que el sistema lo confirme.

## 22. Integración con el Heptafederado

Cada dominio federado debe validar el evento local antes de replicarlo:

```text
Nodo solicitante
      │
      ▼
Valida circuitoHash y policyVersion
      │
      ▼
Valida firma HSM/PQC
      │
      ▼
Comprueba previousHash
      │
      ▼
Acepta o rechaza el bloque
      │
      ▼
Replica digest y metadatos mínimos
```

No se deben replicar:

- Tokens de sesión.
- Claves HSM.
- Credenciales Qiskit/IBM.
- Material de WebAuthn privado.
- Datos personales innecesarios.
- Payloads sensibles sin clasificación.

## 23. Pruebas unitarias

Archivo: `src/quantum/__tests__/quantumPolicy.test.ts`

```ts
import { evaluateQuantumPolicy } from "../argusPolicy";
import type { QuantumExecutionRequest } from "../contracts";

const request: QuantumExecutionRequest = {
  requestId: "b7f43e16-0e51-4a6c-8c25-7c274a3e9de5",
  tenantId: "tenant-a",
  provider: "default.qubit",
  mode: "analytic",
  wires: 2,
  shots: null,
  circuit: {
    wires: 2,
    gates: [{ name: "H", wires: [0] }],
    measurements: [{ name: "probs", wires: [0, 1] }],
  },
  metadata: {},
};

describe("evaluateQuantumPolicy", () => {
  it("allows default.qubit with quantum:execute", () => {
    const result = evaluateQuantumPolicy(
      {
        subject: "yun",
        tenantId: "tenant-a",
        scopes: ["quantum:execute"],
        role: "agent",
      },
      request,
    );

    expect(result.decision).toBe("allow");
  });

  it("denies qiskit without quantum:qiskit", () => {
    const result = evaluateQuantumPolicy(
      {
        subject: "yun",
        tenantId: "tenant-a",
        scopes: ["quantum:execute"],
        role: "agent",
      },
      { ...request, provider: "qiskit.aer" },
    );

    expect(result.decision).toBe("deny");
  });

  it("denies tenant mismatch", () => {
    const result = evaluateQuantumPolicy(
      {
        subject: "yun",
        tenantId: "tenant-b",
        scopes: ["quantum:execute"],
        role: "agent",
      },
      request,
    );

    expect(result.decision).toBe("deny");
  });
});
```

Archivo: `src/quantum/__tests__/quantumService.test.ts`

```ts
import { QuantumService } from "../quantumService";
import type {
  QuantumExecutionRequest,
  QuantumExecutionResult,
} from "../contracts";

class FakePool {
  calls = 0;

  async execute(
    request: QuantumExecutionRequest,
  ): Promise<QuantumExecutionResult> {
    this.calls += 1;

    return {
      requestId: request.requestId,
      status: "completed",
      implementation: "PENNYLANE_SIMULATOR",
      provider: request.provider,
      mode: request.mode,
      result: [[1, 0]],
      telemetry: {
        durationMs: 1,
        queueWaitMs: 0,
        shots: request.shots,
        wires: request.wires,
      },
      audit: {
        policyDecision: "allow",
        circuitHash: "",
      },
    };
  }
}

const request: QuantumExecutionRequest = {
  requestId: "b7f43e16-0e51-4a6c-8c25-7c274a3e9de5",
  tenantId: "tenant-a",
  provider: "default.qubit",
  mode: "analytic",
  wires: 1,
  shots: null,
  circuit: {
    wires: 1,
    gates: [{ name: "H", wires: [0] }],
    measurements: [{ name: "probs", wires: [0] }],
  },
  metadata: {},
};

describe("QuantumService", () => {
  it("returns the same result for a duplicate request", async () => {
    const pool = new FakePool();
    const service = new QuantumService(pool as never);
    const principal = {
      subject: "yun",
      tenantId: "tenant-a",
      scopes: ["quantum:execute"],
      role: "agent" as const,
    };

    const first = await service.execute(principal, request);
    const second = await service.execute(principal, request);

    expect(second).toEqual(first);
    expect(pool.calls).toBe(1);
  });
});
```

## 24. Pruebas de integración del sidecar

Archivo: `scripts/quantum/test_bridge.py`

```python
import json
import subprocess
import sys
import uuid


def test_bridge_returns_json():
    process = subprocess.Popen(
        [sys.executable, "scripts/quantum/pennylane_bridge.py", "--stdio"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    request = {
        "requestId": str(uuid.uuid4()),
        "tenantId": "test",
        "provider": "default.qubit",
        "mode": "analytic",
        "wires": 1,
        "shots": None,
        "circuit": {
            "wires": 1,
            "gates": [{"name": "H", "wires": [0]}],
            "measurements": [{"name": "probs", "wires": [0]}],
        },
        "metadata": {},
    }

    stdout, stderr = process.communicate(
        json.dumps(request) + "\n",
        timeout=15,
    )

    payload = json.loads(stdout.strip().splitlines()[0])
    assert payload["requestId"] == request["requestId"]
    assert payload["implementation"] in {
        "PENNYLANE_SIMULATOR",
        "CLASSICAL_FALLBACK_NOT_QUANTUM",
    }
```

## 25. `package.json`

```json
{
  "scripts": {
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "quantum:bridge:test": "python -m pytest scripts/quantum/test_bridge.py"
  },
  "dependencies": {
    "express": "^4.21.0",
    "pg": "^8.13.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.6.0"
  }
}
```

## 26. `jest.config.ts`

```ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    "src/quantum/**/*.ts",
    "!src/quantum/quantumRuntime.ts",
  ],
};

export default config;
```

## 27. Variables de entorno

```env
NODE_ENV=production
PYTHON_BIN=/opt/isabella/.venv/bin/python
QUANTUM_WORKERS=2
QUANTUM_MAX_QUEUE=32
QUANTUM_TIMEOUT_MS=15000
QUANTUM_MAX_RESPONSE_BYTES=2000000
DATABASE_URL=postgresql://user:password@pooler.example/quantum
DB_POOL_MAX=5

# Solo para el backend o worker, nunca para el frontend
HSM_PRIMARY_KEY_ID=quantum-signing-v1
HSM_BACKUP_KEY_ID=quantum-signing-v1
TEE_EXPECTED_IMAGE_DIGEST=sha256:...
TEE_POLICY_VERSION=quantum-policy-v1
```

## 28. Despliegue recomendado

### Desarrollo local

```bash
npm install
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r scripts/quantum/requirements.txt
npm test
python -m pytest scripts/quantum/test_bridge.py
npm run dev
```

### Producción

```text
Frontend/API: Vercel o Node gateway
Worker pool: contenedor persistente aislado
PostgreSQL: proveedor con pooler
HSM: servicio de firma con YubiHSM o HSM cloud
TEE: runtime de confidential computing con verificación remota
BookPI: almacenamiento append-only
Heptafederado: replicación de digests y eventos autorizados
```

Para alto volumen, el gateway debe publicar trabajos en una cola durable y el worker debe consumirlos. El pool `stdio` local es apropiado para desarrollo, volumen moderado o un servicio persistente; no debe asumirse como garantía de disponibilidad dentro de una función serverless efímera.

## 29. Estados operativos

| Estado | Significado | Acción del cliente |
|---|---|---|
| `completed` | PennyLane ejecutó el proveedor solicitado | Consumir resultado |
| `degraded` | Proveedor no disponible o worker temporalmente no disponible | Mostrar degradación y reintentar con backoff |
| `rejected` | ARGUS negó la operación | No reintentar sin cambiar autorización |
| `failed` | Error interno o circuito inválido | Registrar trace y revisar auditoría |

## 30. Observabilidad

Cada ejecución debe producir al menos:

```json
{
  "event": "quantum.execution.completed",
  "requestId": "uuid",
  "tenantId": "tenant",
  "subject": "yun-agent-01",
  "provider": "default.qubit",
  "implementation": "PENNYLANE_SIMULATOR",
  "status": "completed",
  "wires": 2,
  "gates": 2,
  "shots": null,
  "queueWaitMs": 3,
  "durationMs": 35,
  "circuitHash": "...",
  "policyVersion": "quantum-policy-v1",
  "bookpiBlockHash": "..."
}
```

Nunca deben aparecer en logs:

- Authorization headers.
- Cookies.
- Secretos HSM.
- Credenciales de Qiskit.
- Challenges WebAuthn completos.
- Payloads sensibles sin clasificación.
- Resultados que contengan datos personales sin necesidad operativa.

## 31. Backoff del cliente

Una política razonable para errores transitorios:

```ts
export async function retryQuantum<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const delay = Math.min(
        2_000,
        200 * 2 ** attempt + Math.floor(Math.random() * 100),
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("QUANTUM_RETRY_EXHAUSTED");
}
```

No se deben reintentar automáticamente respuestas `rejected`, ni solicitudes cuyo `requestId` ya tenga un resultado confirmado. Los reintentos solo aplican a fallos transitorios de transporte, cola o worker.

## 32. Límites operativos iniciales

| Parámetro | Usuario | Agente | Operador/servicio |
|---|---:|---:|---:|
| Wires | 12 | 16 | 24 |
| Gates | 64 | 128 | 256 |
| Shots | 10,000 | 20,000 | 100,000 |
| Timeout local | 5 s | 10 s | 20 s |
| Proveedor Qiskit | No | Scope explícito | Scope explícito |
| Hardware real | No | Política separada | Política separada |

Estos valores son puntos de partida, no garantías de capacidad. Deben ajustarse con pruebas de carga, medición de memoria y presupuesto de infraestructura.

## 33. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Proceso Python colgado | Timeout y SIGKILL del worker |
| Explosión de cola | Cola acotada y respuesta `QUANTUM_QUEUE_FULL` |
| Circuito demasiado costoso | Límites por rol, wires, gates y shots |
| Proveedor ausente | Estado `degraded` y etiqueta no cuántica |
| Repetición de request | Idempotencia por tenant y requestId |
| Manipulación de auditoría | Hash canónico, BookPI append-only y firma HSM |
| Elevación de Yun | Scopes externos y política ARGUS |
| Fuga de secretos | Secretos solo en backend, HSM o TEE |
| Worker comprometido | Imagen mínima, usuario sin privilegios y aislamiento |
| TEE mal verificado | Verificación externa de evidencia e imagen |
| Pool PostgreSQL agotado | Pooler, límites por réplica y queries con timeout |
| Réplica federada inconsistente | previousHash, versión de política y validación de firma |

## 34. Integración final con el ecosistema Isabella

```text
Cattleya solicita recurso
        │
        ▼
Yun crea intención cognitiva
        │
        ▼
Isabella normaliza contexto
        │
        ▼
ARGUS decide autorización
        │
        ▼
Quantum Bridge ejecuta PennyLane
        │
        ▼
TEE valida entorno cuando aplica
        │
        ▼
HSM firma resultado y auditoría
        │
        ▼
BookPI crea bloque
        │
        ▼
CRYSTALS-LATAMV enlaza integridad interna
        │
        ▼
PostgreSQL persiste estado
        │
        ▼
Heptafederado replica digest autorizado
```

La frontera crítica es esta: Yun puede proponer, ARGUS puede autorizar, PennyLane puede ejecutar, HSM puede firmar y BookPI puede registrar; ningún componente individual debe poder modificar toda la cadena sin validación cruzada.

## 35. Checklist de aceptación

- [ ] El endpoint rechaza requests sin `quantum:execute`.
- [ ] El tenant del principal coincide con el tenant del request.
- [ ] Qiskit requiere `quantum:qiskit`.
- [ ] El contrato rechaza wires fuera de rango.
- [ ] El contrato rechaza gates no permitidos.
- [ ] El contrato rechaza shots superiores al límite.
- [ ] La cola tiene un máximo fijo.
- [ ] El worker tiene timeout real.
- [ ] Un worker muerto se reemplaza.
- [ ] El resultado indica la implementación real.
- [ ] La ausencia de PennyLane produce `degraded`.
- [ ] El request repetido no duplica la ejecución.
- [ ] El circuito tiene hash canónico.
- [ ] El resultado se persiste junto con telemetría.
- [ ] El bloque BookPI enlaza el hash anterior.
- [ ] Las claves privadas no entran al frontend.
- [ ] La atestación TEE se verifica externamente.
- [ ] Las credenciales de proveedor no se almacenan en PostgreSQL.
- [ ] Yun no puede elevar sus scopes.
- [ ] Los nodos federados reciben solo eventos autorizados.
- [ ] Jest cubre política, servicio, idempotencia y pool.
- [ ] Las pruebas del sidecar funcionan con y sin PennyLane.

## 36. Conclusión técnica

La evolución correcta de Isabella Quantum Bridge no consiste en añadir más nombres criptográficos al frontend. Consiste en construir una frontera de ejecución estricta, con contratos verificables, workers aislados, límites mensurables, autorización externa, persistencia transaccional, auditoría enlazada y degradación honesta.

