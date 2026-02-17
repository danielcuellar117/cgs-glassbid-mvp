import { useParams, useNavigate, Link } from "react-router-dom";
import { useJobSsot, useUpdateSsot } from "@/api/hooks/useJobs";
import { useMeasurementTasks, useSubmitReview, useSkipMeasurementTask, useBulkSkipMeasurementTasks } from "@/api/hooks/useMeasurementTasks";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { FlagChip } from "@/components/shared/FlagChip";
import { SkipReasonDialog } from "@/components/shared/SkipReasonDialog";
import { Loader2, ArrowRight, Ruler, AlertTriangle, CheckCircle2, ExternalLink, Ban, SkipForward } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import type { MeasurementTask } from "@/api/hooks/useMeasurementTasks";

interface DimensionEntry {
  value: number | null;
  unit?: string;
  source?: string;
  confidence?: number;
}

interface SsotItem {
  itemId: string;
  category: string;
  unitId?: string;
  location?: string;
  configuration?: string;
  dimensions?: {
    width?: DimensionEntry;
    height?: DimensionEntry;
    depth?: DimensionEntry;
  };
  glassType?: string;
  hardware?: string[] | string;
  quantityPerUnit?: number;
  flags?: string[];
  sourcePages?: number[];
  // Flat fields that may exist from older saves
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  key?: string;
  qty?: number;
  confidence?: number | null;
  sourcePageNum?: number | null;
}

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
  const skipTask = useSkipMeasurementTask();
  const bulkSkip = useBulkSkipMeasurementTasks();
  const [editingCell, setEditingCell] = useState<{ key: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [skipDialogTarget, setSkipDialogTarget] = useState<{ type: "single"; taskId: string } | { type: "page"; pageNum: number | null; taskIds: string[] } | null>(null);

  const items: ExtractedItem[] = useMemo(() => {
    if (!ssot) return [];
    const rawItems = ssot.items as SsotItem[] | undefined;
    if (!Array.isArray(rawItems)) return [];
    return rawItems.map((item) => {
      const dims = item.dimensions;
      return {
        key: item.itemId ?? item.key ?? "",
        category: item.category ?? "",
        location: item.location ?? item.unitId ?? "",
        configuration: item.configuration ?? "",
        width: dims?.width?.value ?? item.width ?? null,
        height: dims?.height?.value ?? item.height ?? null,
        depth: dims?.depth?.value ?? item.depth ?? null,
        glassType: item.glassType ?? "",
        hardware: Array.isArray(item.hardware)
          ? item.hardware.join(", ")
          : item.hardware ?? "",
        qty: item.quantityPerUnit ?? item.qty ?? 1,
        confidence: dims?.width?.confidence ?? item.confidence ?? null,
        flags: item.flags ?? [],
        sourcePageNum: item.sourcePages?.[0] ?? item.sourcePageNum ?? null,
      };
    });
  }, [ssot]);

  const pendingTasksList = useMemo(
    () => (tasks ?? []).filter((t) => t.status === "PENDING"),
    [tasks],
  );
  const completedTasksList = useMemo(
    () => (tasks ?? []).filter((t) => t.status !== "PENDING"),
    [tasks],
  );
  const pendingTasks = pendingTasksList.length;

  // Group pending tasks by page
  const tasksByPage = useMemo(() => {
    const map = new Map<number | null, MeasurementTask[]>();
    for (const t of pendingTasksList) {
      const page = t.pageNum;
      if (!map.has(page)) map.set(page, []);
      map.get(page)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] ?? 999) - (b[0] ?? 999));
  }, [pendingTasksList]);

  const handleSave = useCallback(
    async (itemKey: string, field: string, value: string) => {
      if (!ssot) return;
      const rawItems = (ssot.items as SsotItem[]) ?? [];
      const numVal = value === "" ? null : Number(value);
      const finalVal = numVal !== null && Number.isNaN(numVal) ? null : numVal;

      const updatedItems = rawItems.map((item) => {
        const key = item.itemId ?? item.key ?? "";
        if (key !== itemKey) return item;

        if (["width", "height", "depth"].includes(field)) {
          const dims = item.dimensions ?? {};
          const dimEntry = dims[field as keyof typeof dims] ?? {
            unit: "in",
            source: "MANUAL",
            confidence: 1,
          };
          return {
            ...item,
            dimensions: {
              ...dims,
              [field]: { ...dimEntry, value: finalVal, source: "MANUAL", confidence: 1 },
            },
          };
        }

        const parsed = Number(value);
        return { ...item, [field]: value === "" ? null : (Number.isNaN(parsed) ? value : parsed) };
      });

      await updateSsot.mutateAsync({
        jobId: id!,
        patch: { items: updatedItems },
      });
      setEditingCell(null);
    },
    [ssot, id, updateSsot],
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

      {/* Pending Measurement Tasks Panel */}
      {pendingTasks > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 text-orange-600 shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">
                {pendingTasks} Measurement Task{pendingTasks !== 1 ? "s" : ""} Pending
              </h3>
              <p className="mt-1 text-sm text-orange-700">
                These items need manual measurements before you can submit for pricing.
                Click a page link to open the measurement tool.
              </p>

              <div className="mt-3 space-y-2">
                {tasksByPage.map(([pageNum, pageTasks]) => (
                  <div key={pageNum ?? "none"} className="rounded-md border border-orange-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-orange-900">
                        {pageNum != null ? `Page ${pageNum}` : "No page assigned"}
                        <span className="ml-2 text-xs font-normal text-orange-600">
                          ({pageTasks.length} task{pageTasks.length !== 1 ? "s" : ""})
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSkipDialogTarget({
                            type: "page",
                            pageNum,
                            taskIds: pageTasks.map((t) => t.id),
                          })}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <Ban size={11} />
                          Skip Page
                        </button>
                        {pageNum != null && (
                          <Link
                            to={`/jobs/${id}/measure/${pageNum}`}
                            className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700 transition-colors"
                          >
                            <Ruler size={12} />
                            Measure
                            <ExternalLink size={10} />
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pageTasks.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs text-orange-800"
                        >
                          {t.itemId.slice(0, 8)}... &rarr; {t.dimensionKey}
                          <button
                            onClick={() => setSkipDialogTarget({ type: "single", taskId: t.id })}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-orange-200 transition-colors"
                            title="Skip this task"
                          >
                            <SkipForward size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed tasks summary */}
      {completedTasksList.length > 0 && pendingTasks === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">All measurement tasks completed!</h3>
              <p className="text-sm text-green-700">You can now submit for pricing.</p>
            </div>
          </div>
        </div>
      )}

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
      {/* Skip reason dialog */}
      {skipDialogTarget?.type === "single" && (
        <SkipReasonDialog
          title="Skip Measurement Task"
          description="This task will be marked as skipped and won't block the pricing submission."
          isPending={skipTask.isPending}
          onCancel={() => setSkipDialogTarget(null)}
          onConfirm={(reason) => {
            skipTask.mutate(
              { id: skipDialogTarget.taskId, reason },
              { onSuccess: () => setSkipDialogTarget(null) },
            );
          }}
        />
      )}
      {skipDialogTarget?.type === "page" && (
        <SkipReasonDialog
          title={`Skip All Tasks on Page ${skipDialogTarget.pageNum ?? "?"}`}
          description={`This will skip ${skipDialogTarget.taskIds.length} pending task${skipDialogTarget.taskIds.length === 1 ? "" : "s"} on this page. They won't block pricing submission.`}
          isPending={bulkSkip.isPending}
          onCancel={() => setSkipDialogTarget(null)}
          onConfirm={(reason) => {
            bulkSkip.mutate(
              { taskIds: skipDialogTarget.taskIds, reason },
              { onSuccess: () => setSkipDialogTarget(null) },
            );
          }}
        />
      )}
    </div>
  );
}
