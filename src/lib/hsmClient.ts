import { assertPrototypeCrypto } from "./crypto/prototype-registry";

type HSMDeviceKey = "primary" | "backup";
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface HSMConfig {
  connectorUrl: string;
  authKey: string;
  deviceId: number;
  priority: number;
  maxRetries: number;
  healthCheckIntervalMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeoutMs: number;
}

interface HSMKey {
  id: number;
  label: string;
  algorithm: "EC_P256" | "EC_P384" | "ED25519" | "AES256";
  capabilities: string[];
}

export interface HSMHealthStatus {
  isConnected: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
  circuitBreakerState: CircuitState;
  responseTimeMs: number;
}

interface HSMDevice extends HSMConfig {
  health: HSMHealthStatus;
  isActive: boolean;
}

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getEnv(name: string): string | undefined {
  return typeof import.meta !== "undefined" ? ((import.meta as any).env?.[name] as string | undefined) : undefined;
}

/**
 * Browser-safe YubiHSM dual-client simulator with automatic health checks,
 * circuit breaker, failover/failback events and deterministic key derivation.
 */
class HSMClient {
  private devices = new Map<HSMDeviceKey, HSMDevice>();
  private currentDevice: HSMDeviceKey = "primary";
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isFailingOver = false;
  private eventListeners = new Map<string, Array<(data: unknown) => void>>();

  constructor() {
    this.devices.set("primary", this.createDevice("primary", 1, getEnv("VITE_YUBIHSM_PRIMARY_URL") || "https://hsm1.tamv.mx:12345"));
    this.devices.set("backup", this.createDevice("backup", 2, getEnv("VITE_YUBIHSM_BACKUP_URL") || "https://hsm2.tamv.mx:12345"));
    this.setupNetworkListeners();
  }

  private createDevice(key: HSMDeviceKey, priority: number, connectorUrl: string): HSMDevice {
    return {
      connectorUrl,
      authKey: getEnv(key === "primary" ? "VITE_YUBIHSM_PRIMARY_AUTH_KEY" : "VITE_YUBIHSM_BACKUP_AUTH_KEY") || "",
      deviceId: priority,
      priority,
      maxRetries: 3,
      healthCheckIntervalMs: 5000,
      circuitBreakerThreshold: 3,
      circuitBreakerResetTimeoutMs: 30000,
      health: { isConnected: false, lastHealthCheck: 0, consecutiveFailures: 0, circuitBreakerState: "CLOSED", responseTimeMs: 0 },
      isActive: priority === 1,
    };
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) return;
    this.healthCheckInterval = setInterval(async () => {
      try {
        await Promise.all([this.performHealthCheck("primary"), this.performHealthCheck("backup")]);
        await this.evaluateFailover();
      } catch (err) {
        console.error("[HSM] Health check interval error:", err);
      }
    }, this.devices.get("primary")!.healthCheckIntervalMs);
  }

  private async performHealthCheck(deviceKey: HSMDeviceKey): Promise<void> {
    const device = this.devices.get(deviceKey)!;
    const started = Date.now();
    const isConnected = await this.pingDevice();
    const failures = isConnected ? 0 : device.health.consecutiveFailures + 1;
    device.health = {
      ...device.health,
      isConnected,
      lastHealthCheck: Date.now(),
      consecutiveFailures: failures,
      responseTimeMs: Date.now() - started,
      circuitBreakerState: failures >= device.circuitBreakerThreshold ? "OPEN" : isConnected ? "CLOSED" : device.health.circuitBreakerState,
    };
    this.emit("health_check", { device: deviceKey, isConnected, responseTimeMs: device.health.responseTimeMs, consecutiveFailures: failures });
  }

  private async pingDevice(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
    return Math.random() > 0.03;
  }

  private async evaluateFailover(): Promise<void> {
    if (this.isFailingOver) return;
    const primary = this.devices.get("primary")!;
    const backup = this.devices.get("backup")!;
    if (this.currentDevice === "primary" && (!primary.health.isConnected || primary.health.circuitBreakerState === "OPEN") && backup.health.isConnected) {
      await this.failoverTo("backup");
    } else if (this.currentDevice === "backup" && primary.health.isConnected && primary.health.circuitBreakerState !== "OPEN") {
      await this.failoverTo("primary");
    }
  }

  private async failoverTo(deviceKey: HSMDeviceKey): Promise<void> {
    this.isFailingOver = true;
    const from = this.currentDevice;
    this.currentDevice = deviceKey;
    this.devices.forEach((device, key) => { device.isActive = key === deviceKey; });
    this.emit("failover", { from, to: deviceKey, timestamp: Date.now(), reason: "automatic_health_check" });
    this.isFailingOver = false;
  }

  async connect(): Promise<void> {
    assertPrototypeCrypto("HSM_SIMULATOR");
    await this.connectToDevice("primary").catch(() => this.connectToDevice("backup"));
    this.startHealthChecks();
    this.emit("connected", { device: this.currentDevice, timestamp: Date.now() });
  }

  private async connectToDevice(deviceKey: HSMDeviceKey): Promise<void> {
    const device = this.devices.get(deviceKey)!;
    await new Promise((resolve) => setTimeout(resolve, 75));
    device.health.isConnected = true;
    device.health.consecutiveFailures = 0;
    device.health.circuitBreakerState = "CLOSED";
    this.currentDevice = deviceKey;
  }

  async generateAESKey(label: string): Promise<HSMKey> {
    assertPrototypeCrypto("HSM_SIMULATOR");
    const hex = await sha256Hex(`${label}:${Date.now()}:${this.currentDevice}`);
    return { id: Number.parseInt(hex.slice(0, 6), 16), label, algorithm: "AES256", capabilities: ["encrypt", "decrypt", "wrap", "unwrap"] };
  }

  async deriveKey(baseKeyId: number, salt: string): Promise<string> {
    assertPrototypeCrypto("HSM_SIMULATOR");
    return sha256Hex(`${baseKeyId}:${salt}:${this.currentDevice}`);
  }

  async signWithHSMKey(keyId: number, data: string): Promise<string> {
    assertPrototypeCrypto("HSM_SIMULATOR");
    return `hsm_${this.currentDevice}_${keyId}_${(await sha256Hex(data)).slice(0, 32)}`;
  }

  getStatus() {
    return { isConnected: [...this.devices.values()].some((device) => device.health.isConnected), currentDevice: this.currentDevice, timestamp: Date.now(), devices: { primary: { ...this.devices.get("primary")!.health }, backup: { ...this.devices.get("backup")!.health } }, isFailingOver: this.isFailingOver };
  }

  on(event: string, callback: (data: unknown) => void): void {
    this.eventListeners.set(event, [...(this.eventListeners.get(event) || []), callback]);
  }

  private emit(event: string, data: unknown): void {
    (this.eventListeners.get(event) || []).forEach((listener) => listener(data));
  }

  private setupNetworkListeners(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", () => void this.connect());
    window.addEventListener("offline", () => this.emit("network_offline", { timestamp: Date.now() }));
  }
}

export const hsmClient = new HSMClient();
