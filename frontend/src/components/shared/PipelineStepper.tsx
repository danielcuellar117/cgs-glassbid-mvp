import { cn } from "@/lib/utils";
import { PIPELINE_STEPS, type JobState } from "@/lib/constants";
import { Check, Loader2, X } from "lucide-react";

interface PipelineStepperProps {
  currentStatus: string;
  className?: string;
}

export function PipelineStepper({ currentStatus, className }: PipelineStepperProps) {
  const currentIdx = PIPELINE_STEPS.indexOf(currentStatus as JobState);
  const isFailed = currentStatus === "FAILED";

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-2", className)}>
      {PIPELINE_STEPS.map((step, i) => {
        const isCompleted = !isFailed && currentIdx > i;
        const isCurrent = currentIdx === i;
        const isActive = isCurrent && !isFailed;

        return (
          <div key={step} className="flex items-center gap-1">
            {/* Step circle */}
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all shrink-0",
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
              className={cn(
                "text-[11px] whitespace-nowrap",
                isCompleted && "text-green-700 font-medium",
                isActive && "text-foreground font-semibold",
                isFailed && isCurrent && "text-red-700 font-semibold",
                !isCompleted && !isCurrent && "text-muted-foreground",
              )}
            >
              {step.replace(/_/g, " ")}
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
