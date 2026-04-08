import type { Priority } from "@/lib/types";
import { PRIORITY_COLORS } from "@/lib/types";

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[priority]}`}
    >
      {priority}
    </span>
  );
}
