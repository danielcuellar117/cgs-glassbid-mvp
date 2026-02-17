import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_REASONS = [
  "Not a glass/window page",
  "Specifications or text only",
  "Duplicate or repeated content",
  "Not applicable to this bid",
  "Page cannot be measured accurately",
] as const;

interface SkipReasonDialogProps {
  readonly title: string;
  readonly description: string;
  readonly onConfirm: (reason: string) => void;
  readonly onCancel: () => void;
  readonly isPending?: boolean;
}

export function SkipReasonDialog({
  title,
  description,
  onConfirm,
  onCancel,
  isPending = false,
}: SkipReasonDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");

  const effectiveReason = selectedPreset === "__custom__" ? customReason.trim() : selectedPreset;
  const canSubmit = !!effectiveReason && !isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Select a reason
          </p>
          {PRESET_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                setSelectedPreset(reason);
                setCustomReason("");
              }}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selectedPreset === reason
                  ? "border-primary bg-primary/5 text-primary font-medium"
                  : "border-border hover:bg-muted/50",
              )}
            >
              {reason}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedPreset("__custom__")}
            className={cn(
              "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
              selectedPreset === "__custom__"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border hover:bg-muted/50",
            )}
          >
            Other (custom reason)...
          </button>
          {selectedPreset === "__custom__" && (
            <textarea
              autoFocus
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe why these tasks should be skipped..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2}
            />
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => effectiveReason && onConfirm(effectiveReason)}
            disabled={!canSubmit}
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Skipping..." : "Skip Tasks"}
          </button>
        </div>
      </div>
    </div>
  );
}
