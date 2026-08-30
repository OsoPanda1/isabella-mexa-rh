// ==== Isabella Ledger — hook de datos ====
// El cliente sólo consume el DTO de la API. No genera estado operativo ni
// simula el ledger: si no hay datos, reporta `unavailable` (sin fake data).

import { useCallback, useEffect, useState } from "react";
import type { LedgerSnapshot } from "./contracts";

export interface UseLedgerResult {
  snapshot: LedgerSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: (signal?: AbortSignal) => Promise<void>;
}

export function useLedger(cursor?: string): UseLedgerResult {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/ledger?cursor=${encodeURIComponent(cursor ?? "")}`,
          { headers: { Accept: "application/json" }, signal },
        );
        if (!response.ok) throw new Error(`LEDGER_HTTP_${response.status}`);
        const value = (await response.json()) as LedgerSnapshot;
        setSnapshot(value);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "LEDGER_UNAVAILABLE");
        }
      } finally {
        setLoading(false);
      }
    },
    [cursor],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return { snapshot, loading, error, refresh };
}
