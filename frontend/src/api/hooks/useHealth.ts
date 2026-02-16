import { useQuery } from "@tanstack/react-query";

export interface HealthData {
  status: string;
  db: { connected: boolean };
  disk: { totalGB: number; usedGB: number; freeGB: number; usedPercent: number };
  worker: { lastHeartbeat: string | null; stale: boolean };
  memory: { rss: number; heapUsed: number; heapTotal: number };
}

// Maps the raw API response to our normalized HealthData shape
function normalizeHealth(raw: Record<string, unknown>): HealthData {
  // DB
  const dbRaw = raw.db;
  const dbConnected =
    typeof dbRaw === "string" ? dbRaw === "connected" : (dbRaw as Record<string, unknown>)?.connected === true;

  // Disk
  const diskUsagePct = typeof raw.diskUsagePct === "number" ? raw.diskUsagePct : 0;

  // Worker
  const ws = raw.workerStatus as Record<string, unknown> | undefined;
  const lastHeartbeat = ws?.lastHeartbeatAt as string | null ?? null;
  const workerStale = ws
    ? (ws.status === "OFFLINE" || !lastHeartbeat)
    : true;

  // Memory
  const mem = raw.memoryUsage as Record<string, unknown> | undefined;

  return {
    status: String(raw.status ?? "unknown"),
    db: { connected: dbConnected },
    disk: {
      totalGB: 0,
      usedGB: 0,
      freeGB: 0,
      usedPercent: diskUsagePct,
    },
    worker: {
      lastHeartbeat,
      stale: workerStale,
    },
    memory: {
      rss: Number(mem?.rss ?? 0),
      heapUsed: Number(mem?.heapUsed ?? 0),
      heapTotal: Number(mem?.heapTotal ?? 0),
    },
  };
}

export function useHealth(refetchInterval = 10000) {
  return useQuery<HealthData>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/health");
      const raw = await res.json();
      return normalizeHealth(raw);
    },
    refetchInterval,
  });
}
