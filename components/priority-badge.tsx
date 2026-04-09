import type { Priority } from "@/lib/types";

const COLORS: Record<Priority, string> = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${COLORS[priority]}`}
    >
      {priority}
    </span>
  );
}
