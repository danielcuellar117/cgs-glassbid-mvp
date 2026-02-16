import { useParams, useNavigate, Link } from "react-router-dom";
import { useJobSsot, useUpdateSsot } from "@/api/hooks/useJobs";
import { useMeasurementTasks, useSubmitReview } from "@/api/hooks/useMeasurementTasks";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { FlagChip } from "@/components/shared/FlagChip";
import { Loader2, ArrowRight, Ruler } from "lucide-react";
import { useMemo, useState, useCallback } from "react";

interface ExtractedItem {
  key: string;
  category: string;
  location: string;
  configuration: string;
  width: number | null;
  height: number | null;
  depth: number | null;
  glassType: string;
  hardware: string;
  qty: number;
  confidence: number | null;
  flags: string[];
  sourcePageNum: number | null;
}

export function ReviewEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ssot, isLoading } = useJobSsot(id!);
  const { data: tasks } = useMeasurementTasks(id!);
  const updateSsot = useUpdateSsot();
  const submitReview = useSubmitReview();
  const [editingCell, setEditingCell] = useState<{ key: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const items: ExtractedItem[] = useMemo(() => {
    if (!ssot) return [];
    const extractedItems = ssot.items as ExtractedItem[] | undefined;
    if (Array.isArray(extractedItems)) return extractedItems;
    return [];
  }, [ssot]);

  const pendingTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.status === "PENDING").length,
    [tasks],
  );

  const handleSave = useCallback(
    async (itemKey: string, field: string, value: string) => {
      const updatedItems = items.map((item) => {
        if (item.key !== itemKey) return item;
        const numVal = Number(value);
        return {
          ...item,
          [field]: isNaN(numVal) ? value : numVal,
        };
      });
      await updateSsot.mutateAsync({
        jobId: id!,
        patch: { items: updatedItems },
      });
      setEditingCell(null);
    },
    [items, id, updateSsot],
  );

  const handleSubmitForPricing = useCallback(async () => {
    await submitReview.mutateAsync(id!);
    navigate(`/jobs/${id}/pricing`);
  }, [id, submitReview, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Items</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} items extracted. Edit inline or complete measurement tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingTasks > 0 && (
            <span className="text-sm text-orange-600 font-medium">
              {pendingTasks} measurement task(s) pending
            </span>
          )}
          <button
            onClick={handleSubmitForPricing}
            disabled={pendingTasks > 0 || submitReview.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitReview.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} />
            )}
            Submit for Pricing
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">
            No items extracted yet. The pipeline may still be processing.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["#", "Category", "Location", "Configuration", "W", "H", "D", "Glass", "Hardware", "Qty", "Confidence", "Flags", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.key} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">{item.location}</td>
                  <td className="px-3 py-2">{item.configuration}</td>
                  {(["width", "height", "depth"] as const).map((dim) => (
                    <td key={dim} className="px-3 py-2">
                      {editingCell?.key === item.key && editingCell?.field === dim ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSave(item.key, dim, editValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave(item.key, dim, editValue);
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="w-16 rounded border border-input bg-background px-1.5 py-0.5 text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer rounded px-1 py-0.5 hover:bg-muted"
                          onClick={() => {
                            setEditingCell({ key: item.key, field: dim });
                            setEditValue(String(item[dim] ?? ""));
                          }}
                        >
                          {item[dim] != null ? `${item[dim]}"` : "—"}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-xs">{item.glassType || "—"}</td>
                  <td className="px-3 py-2 text-xs">{item.hardware || "—"}</td>
                  <td className="px-3 py-2">{item.qty}</td>
                  <td className="px-3 py-2">
                    <ConfidenceBadge confidence={item.confidence} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.flags?.map((f) => <FlagChip key={f} flag={f} />)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {item.sourcePageNum != null && (
                      <Link
                        to={`/jobs/${id}/measure/${item.sourcePageNum}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        title="Go to Measurement"
                      >
                        <Ruler size={12} /> Measure
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
