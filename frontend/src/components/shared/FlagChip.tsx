import { cn } from "@/lib/utils";
import { AlertTriangle, Eye } from "lucide-react";

interface FlagChipProps {
  flag: string;
  className?: string;
}

const FLAG_STYLES: Record<string, { color: string; icon: React.ComponentType<{ size?: number }> }> = {
  NEEDS_REVIEW: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: Eye },
  TO_BE_VERIFIED_IN_FIELD: { color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
};

export function FlagChip({ flag, className }: FlagChipProps) {
  const style = FLAG_STYLES[flag] ?? {
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: AlertTriangle,
  };
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        style.color,
        className,
      )}
    >
      <Icon size={12} />
      {flag.replace(/_/g, " ")}
    </span>
  );
}
