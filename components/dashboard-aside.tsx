import Link from "next/link";
import { Clock, AlertTriangle, CalendarDays, ChevronRight } from "lucide-react";
import type { Task, Status } from "@/lib/types";

interface DashboardAsideProps {
  tasks: Task[];
}

export function DashboardAside({ tasks }: DashboardAsideProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  let overdueCount = 0;
  let todayCount = 0;
  let weekCount = 0;
  const upcoming: Task[] = [];

  const statusCounts: Record<string, number> = {};

  for (const t of tasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;

    if (!t.dueDate) continue;
    const due = new Date(t.dueDate.start);
    due.setHours(0, 0, 0, 0);

    if (due < today && t.status !== "Completed") {
      overdueCount++;
    } else if (due.getTime() === today.getTime()) {
      todayCount++;
    } else if (due <= weekEnd) {
      weekCount++;
      if (upcoming.length < 3) upcoming.push(t);
    }
  }

  const STATUS_LABELS: [Status, string][] = [
    ["In Progress", "text-blue-600 dark:text-blue-400"],
    ["Not Started", "text-neutral-500 dark:text-neutral-400"],
    ["On Hold", "text-orange-500 dark:text-orange-400"],
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary card */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5 lg:sticky lg:top-6">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">At a Glance</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${overdueCount > 0 ? "text-red-500" : "text-neutral-300 dark:text-neutral-600"}`} />
            <p className={`text-lg font-bold ${overdueCount > 0 ? "text-red-600" : "text-neutral-400"}`}>{overdueCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Overdue</p>
          </div>
          <div className="text-center">
            <Clock className="w-4 h-4 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{todayCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Today</p>
          </div>
          <div className="text-center">
            <CalendarDays className="w-4 h-4 mx-auto mb-1 text-neutral-400" />
            <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{weekCount}</p>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">This Week</p>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {STATUS_LABELS.map(([s, color]) => {
            const count = statusCounts[s] || 0;
            if (count === 0) return null;
            return (
              <span key={s} className={`font-medium ${color}`}>
                {count} {s}
              </span>
            );
          })}
        </div>
      </div>

      {/* Upcoming preview */}
      {upcoming.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">Coming Up</h3>
          <div className="flex flex-col gap-2">
            {upcoming.map((t) => (
              <Link
                key={t.id}
                href={`/task/${t.id}`}
                className="flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{t.task}</p>
                  <p className="text-xs text-neutral-400">{t.dueDate?.start}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
