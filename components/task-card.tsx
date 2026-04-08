import Link from "next/link";
import { format, isPast, isWithinInterval, addDays } from "date-fns";
import { ChevronRight, Calendar, DollarSign, MapPin } from "lucide-react";
import type { Task } from "@/lib/types";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";

function DueDateLabel({ dueDate }: { dueDate: Task["dueDate"] }) {
  if (!dueDate) return null;
  const date = new Date(dueDate.start + "T00:00:00");
  const now = new Date();
  const overdue = isPast(date) && dueDate.start < format(now, "yyyy-MM-dd");
  const dueSoon = isWithinInterval(date, { start: now, end: addDays(now, 3) });

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        overdue
          ? "text-red-600 font-semibold"
          : dueSoon
            ? "text-orange-600"
            : "text-gray-500"
      }`}
    >
      <Calendar className="w-3 h-3" />
      {overdue ? "Overdue: " : ""}
      {format(date, "MMM d")}
      {dueDate.end ? ` – ${format(new Date(dueDate.end + "T00:00:00"), "MMM d")}` : ""}
    </span>
  );
}

export function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      href={`/task/${task.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
          <h3 className="font-medium text-gray-900 truncate">{task.task}</h3>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {task.area && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                {task.area}
                {task.subLocation ? ` · ${task.subLocation}` : ""}
              </span>
            )}
            <DueDateLabel dueDate={task.dueDate} />
            {task.costEstimate !== null && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <DollarSign className="w-3 h-3" />
                {task.costEstimate.toLocaleString()}
              </span>
            )}
          </div>

          {task.type.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.type.map((t) => (
                <span
                  key={t}
                  className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}
