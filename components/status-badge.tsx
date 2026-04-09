import type { Status } from "@/lib/types";

const COLORS: Record<Status, string> = {
  "Not Started": "bg-neutral-100 text-neutral-600 border-neutral-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  "On Hold": "bg-orange-50 text-orange-700 border-orange-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${COLORS[status]}`}
    >
      {status}
    </span>
  );
}
