import { useHealth } from "@/api/hooks/useHealth";
import { Loader2, RefreshCw } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export function SystemHealth() {
  const { data: health, isLoading, refetch, dataUpdatedAt } = useHealth(10000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-sm text-muted-foreground">
            Auto-refreshing every 10 seconds.
            {dataUpdatedAt ? (
              <span className="ml-1">
                Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <RefreshCw size={14} />
          Refresh Now
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : health ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Overall Status */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Status</h2>
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full ${
                  health.status === "ok" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xl font-bold uppercase">
                {health.status}
              </span>
            </div>
          </div>

          {/* Database */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Database</h2>
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  health.db.connected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm">
                {health.db.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Disk */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Disk Usage</h2>
            <div className="space-y-3">
              <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    health.disk.usedPercent > 80
                      ? "bg-red-500"
                      : health.disk.usedPercent > 60
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${health.disk.usedPercent}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Used</p>
                  <p className="font-medium">{health.disk.usedGB.toFixed(1)} GB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Free</p>
                  <p className="font-medium">{health.disk.freeGB.toFixed(1)} GB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">{health.disk.totalGB.toFixed(1)} GB</p>
                </div>
              </div>
              <p className="text-sm">
                <span className="font-semibold">{health.disk.usedPercent.toFixed(1)}%</span>{" "}
                used
              </p>
            </div>
          </div>

          {/* Worker */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Worker</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    !health.worker.stale ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm">
                  {health.worker.stale ? "Stale / Offline" : "Active"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Last heartbeat:{" "}
                {health.worker.lastHeartbeat
                  ? new Date(health.worker.lastHeartbeat).toLocaleString()
                  : "Never"}
              </p>
            </div>
          </div>

          {/* Memory */}
          <div className="col-span-full rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">App Memory</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">RSS</p>
                <p className="text-lg font-medium">{formatBytes(health.memory.rss)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Heap Used</p>
                <p className="text-lg font-medium">{formatBytes(health.memory.heapUsed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Heap Total</p>
                <p className="text-lg font-medium">{formatBytes(health.memory.heapTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Failed to load health data.</p>
        </div>
      )}
    </div>
  );
}
