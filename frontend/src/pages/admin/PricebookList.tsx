import { useNavigate } from "react-router-dom";
import { usePricebookVersions, useCreatePricebook } from "@/api/hooks/usePricing";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { formatDate } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";
import { useState, useCallback } from "react";

export function PricebookList() {
  const navigate = useNavigate();
  const { data: versions, isLoading } = usePricebookVersions();
  const createPricebook = useCreatePricebook();
  const [showNew, setShowNew] = useState(false);
  const [newNotes, setNewNotes] = useState("");

  const handleCreate = useCallback(async () => {
    await createPricebook.mutateAsync({
      notes: newNotes || undefined,
    });
    setShowNew(false);
    setNewNotes("");
  }, [newNotes, createPricebook]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "version",
      header: "Version",
      sortable: true,
      render: (row) => <span className="font-semibold">v{String(row.version)}</span>,
    },
    {
      key: "effectiveDate",
      header: "Effective Date",
      sortable: true,
      render: (row) => (
        <span className="text-sm">
          {row.effectiveDate
            ? new Date(String(row.effectiveDate)).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{String(row.notes ?? "—")}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(String(row.createdAt))}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricebook Versions</h1>
          <p className="text-sm text-muted-foreground">
            Manage pricing rule versions.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus size={16} /> New Version
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold">Create New Pricebook Version</h3>
          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createPricebook.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createPricebook.isPending ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <DataTable
        data={(versions ?? []) as unknown as Record<string, unknown>[]}
        columns={columns}
        keyExtractor={(row) => String(row.id)}
        onRowClick={(row) => navigate(`/admin/pricebook/${row.id}`)}
        emptyMessage="No pricebook versions yet."
      />
    </div>
  );
}
