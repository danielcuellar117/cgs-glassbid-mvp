import { cn } from "@/lib/utils";
import { JOB_STATE_COLORS, type JobState } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors =
    JOB_STATE_COLORS[status as JobState] ?? "bg-gray-100 text-gray-800";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors,
        className,
      )}
    >
      {status}
    </span>
  );
}
