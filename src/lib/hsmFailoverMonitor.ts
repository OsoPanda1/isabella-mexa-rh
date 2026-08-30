import { hsmClient } from "./hsmClient";

interface FailoverMetrics {
  totalFailovers: number;
  lastFailoverTime: number | null;
  healthCheckSuccessRate: number;
}

class HSMFailoverMonitor {
  private metrics: FailoverMetrics = { totalFailovers: 0, lastFailoverTime: null, healthCheckSuccessRate: 100 };
  private healthChecks: boolean[] = [];

  constructor() {
    hsmClient.on("failover", () => {
      this.metrics.totalFailovers += 1;
      this.metrics.lastFailoverTime = Date.now();
    });
    hsmClient.on("health_check", (data) => {
      const check = data as { isConnected?: boolean };
      this.healthChecks.push(!!check.isConnected);
      this.healthChecks = this.healthChecks.slice(-100);
      const successes = this.healthChecks.filter(Boolean).length;
      this.metrics.healthCheckSuccessRate = this.healthChecks.length ? (successes / this.healthChecks.length) * 100 : 100;
    });
  }

  getMetrics(): FailoverMetrics {
    return { ...this.metrics };
  }
}

export const hsmFailoverMonitor = new HSMFailoverMonitor();
