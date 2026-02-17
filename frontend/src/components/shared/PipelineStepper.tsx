import { cn } from "@/lib/utils";
import { PIPELINE_STEPS, STEP_LABELS, STEP_DESCRIPTIONS, type JobState } from "@/lib/constants";
import { Check, Loader2, X } from "lucide-react";

interface PipelineStepperProps {
  readonly currentStatus: string;
  readonly className?: string;
}

export function PipelineStepper({ currentStatus, className }: PipelineStepperProps) {
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus as JobState);
  const isFailed = currentStatus === "FAILED";
  const isDone = currentStatus === "DONE";

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-2", className)}>
      {PIPELINE_STEPS.map((step, i) => {
        const isCompleted = !isFailed && (isDone || currentIdx > i);
        const isCurrent = currentIdx === i && !isDone;
        const isActive = isCurrent && !isFailed;
        const label = STEP_LABELS[step] ?? step.replaceAll("_", " ");
        const tooltip = STEP_DESCRIPTIONS[step] ?? "";

        return (
          <div key={step} className="flex items-center gap-1 group relative">
            {/* Step circle */}
            <div
              title={tooltip}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all shrink-0 cursor-help",
                isCompleted && "bg-green-500 text-white",
                isActive && "bg-primary text-primary-foreground animate-pulse",
                isFailed && isCurrent && "bg-red-500 text-white",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
              )}
            >
              {isCompleted ? (
                <Check size={14} />
              ) : isFailed && isCurrent ? (
                <X size={14} />
              ) : isActive ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                i + 1
              )}
            </div>

            {/* Label */}
            <span
              title={tooltip}
              className={cn(
                "text-[11px] whitespace-nowrap cursor-help",
                isCompleted && "text-green-700 font-medium",
                isActive && "text-foreground font-semibold",
                isFailed && isCurrent && "text-red-700 font-semibold",
                !isCompleted && !isCurrent && "text-muted-foreground",
              )}
            >
              {label}
            </span>

            {/* Connector line */}
            {i < PIPELINE_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-4 shrink-0",
                  isCompleted ? "bg-green-400" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
