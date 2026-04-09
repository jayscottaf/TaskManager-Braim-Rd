import { isPast, isWithinInterval, addDays, format } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";
import type { Task } from "@/lib/types";

export function OverdueBanner({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");

  const overdue = tasks.filter(
    (t) =>
      t.dueDate &&
      t.status !== "Completed" &&
      t.dueDate.start < today
  );

  const dueSoon = tasks.filter(
    (t) =>
      t.dueDate &&
      t.status !== "Completed" &&
      t.dueDate.start >= today &&
      isWithinInterval(new Date(t.dueDate.start + "T00:00:00"), {
        start: now,
        end: addDays(now, 3),
      })
  );

  if (overdue.length === 0 && dueSoon.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-5">
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50/50 border-l-2 border-l-red-500 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700 font-semibold">
            {overdue.length} overdue task{overdue.length > 1 ? "s" : ""}
          </span>
        </div>
      )}
      {dueSoon.length > 0 && (
        <div className="flex items-center gap-3 bg-orange-50/50 border-l-2 border-l-orange-400 rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <span className="text-sm text-orange-700 font-medium">
            {dueSoon.length} task{dueSoon.length > 1 ? "s" : ""} due in the next 3 days
          </span>
        </div>
      )}
    </div>
  );
}
