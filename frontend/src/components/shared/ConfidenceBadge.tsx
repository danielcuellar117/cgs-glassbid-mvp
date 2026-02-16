import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number | null | undefined;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  if (confidence == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800",
          className,
        )}
      >
        N/A
      </span>
    );
  }

  const color =
    confidence >= 0.9
      ? "bg-green-100 text-green-800"
      : confidence >= 0.5
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        color,
        className,
      )}
    >
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}
