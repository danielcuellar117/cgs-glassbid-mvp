import { useParams, useNavigate, Link } from "react-router-dom";
import { useJobSsot, useUpdateSsot } from "@/api/hooks/useJobs";
import { usePriceOverride } from "@/api/hooks/usePricing";
import { Loader2, DollarSign, ArrowRight, AlertCircle } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { api } from "@/api/client";

interface PricingItem {
  key: string;
  description: string;
  category: string;
  qty: number;
  unitPrice: number;
  total: number;
  breakdown: {
    glass: number;
    hardware: number;
    labor: number;
    other: number;
  };
  overridePrice?: number;
  overrideReason?: string;
}

export function PricingReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ssot, isLoading, refetch } = useJobSsot(id!);
  const priceOverride = usePriceOverride();
  const updateSsot = useUpdateSsot();

  const [overrideDialog, setOverrideDialog] = useState<{ key: string; current: number } | null>(null);
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const pricing = useMemo(() => {
    if (!ssot?.pricing) return null;
    return ssot.pricing as {
      lineItems?: PricingItem[];
      subtotal?: number;
      tax?: number;
      total?: number;
    };
  }, [ssot]);

  const items = pricing?.lineItems ?? [];
  const subtotal = pricing?.subtotal ?? 0;
  const tax = pricing?.tax ?? 0;
  const total = pricing?.total ?? 0;

  const handleOverride = useCallback(async () => {
    if (!overrideDialog || !overridePrice) return;
    await priceOverride.mutateAsync({
      jobId: id!,
      itemKey: overrideDialog.key,
      overridePrice: parseFloat(overridePrice),
      reason: overrideReason || "Manual override",
    });
    setOverrideDialog(null);
    setOverridePrice("");
    setOverrideReason("");
    refetch();
  }, [overrideDialog, overridePrice, overrideReason, id, priceOverride, refetch]);

  const handleGenerate = useCallback(async () => {
    const confirmed = globalThis.confirm(
      "This will generate your Bid Proposal and Shop Drawings PDFs. Make sure all prices are correct before proceeding.\n\nContinue?",
    );
    if (!confirmed) return;

    setGenerating(true);
    setGenError(null);
    try {
      await updateSsot.mutateAsync({
        jobId: id!,
        patch: { _triggerGenerate: true },
      });
      // Transition job to GENERATING
      await api.patch(`/jobs/${id}/ssot`, { _status: "GENERATING" });
      navigate(`/jobs/${id}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [id, updateSsot, navigate]);

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
          <h1 className="text-2xl font-bold tracking-tight">Pricing Review</h1>
          <p className="text-sm text-muted-foreground">
            Review pricing, apply overrides, then generate output PDFs.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || items.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ArrowRight size={14} />
          )}
          Generate PDFs
        </button>
      </div>

      {genError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle size={16} className="mt-0.5 text-destructive" />
          <p className="text-sm text-destructive">{genError}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <DollarSign size={32} className="mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No pricing data yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pricing will be calculated after you review all extracted items and submit for pricing.
          </p>
          <Link
            to={`/jobs/${id}/review`}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Go to Review &rarr;
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["#", "Description", "Category", "Qty", "Unit Price", "Total", "Glass", "Hardware", "Labor", "Other", ""].map(
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
                  <td className="px-3 py-2 font-medium">{item.description}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">{item.qty}</td>
                  <td className="px-3 py-2">
                    ${(item.overridePrice ?? item.unitPrice).toFixed(2)}
                    {item.overridePrice != null && (
                      <span className="ml-1 text-[10px] text-orange-600">(override)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    ${((item.overridePrice ?? item.unitPrice) * item.qty).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    ${item.breakdown?.glass?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    ${item.breakdown?.hardware?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    ${item.breakdown?.labor?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    ${item.breakdown?.other?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() =>
                        setOverrideDialog({ key: item.key, current: item.unitPrice })
                      }
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      Override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-medium">
                  Subtotal
                </td>
                <td className="px-3 py-2 font-bold">${subtotal.toFixed(2)}</td>
                <td colSpan={5} />
              </tr>
              <tr className="bg-muted/30">
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-medium">
                  Tax
                </td>
                <td className="px-3 py-2">${tax.toFixed(2)}</td>
                <td colSpan={5} />
              </tr>
              <tr className="bg-muted/30 border-t border-border">
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-bold">
                  Total
                </td>
                <td className="px-3 py-2 text-lg font-bold">${total.toFixed(2)}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Override dialog */}
      {overrideDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-96 rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-3 font-semibold">Override Unit Price</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Current: ${overrideDialog.current.toFixed(2)}
            </p>
            <div className="space-y-3">
              <input
                type="number"
                step="0.01"
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                placeholder="New unit price"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for override"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setOverrideDialog(null);
                  setOverridePrice("");
                  setOverrideReason("");
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleOverride}
                disabled={!overridePrice || priceOverride.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
