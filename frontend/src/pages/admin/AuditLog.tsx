import { useAuditLog } from "@/api/hooks/useAuditLog";
import { formatDate } from "@/lib/utils";
import { Loader2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useState, useCallback } from "react";

export function AuditLog() {
  const [page, setPage] = useState(0);
  const [jobFilter, setJobFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;

  const { data: entries, isLoading } = useAuditLog({
    jobId: jobFilter || undefined,
    limit,
    offset: page * limit,
  });

  const toggle = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Track all actions and changes across the system.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by Job ID..."
            value={jobFilter}
            onChange={(e) => {
              setJobFilter(e.target.value);
              setPage(0);
            }}
            className="w-64 rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["", "Timestamp", "Actor", "Action", "Job ID", "Summary"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                (entries ?? []).map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      className="border-b border-border hover:bg-muted/20 cursor-pointer"
                      onClick={() => toggle(entry.id)}
                    >
                      <td className="px-2 py-2 w-8">
                        {expandedId === entry.id ? (
                          <ChevronUp size={14} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={14} className="text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {entry.actor}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium">{entry.action}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {entry.jobId ? `${entry.jobId.slice(0, 8)}...` : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate">
                        {entry.diff
                          ? JSON.stringify(entry.diff).slice(0, 80)
                          : "—"}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr key={`${entry.id}-detail`}>
                        <td colSpan={6} className="bg-muted/20 px-6 py-4">
                          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                            Diff / Details
                          </h4>
                          <pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs">
                            {JSON.stringify(entry.diff, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={(entries ?? []).length < limit}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
