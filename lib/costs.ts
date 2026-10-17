import type { Task } from "./types";
import { householdCalendarNow, householdDateKey } from "./household-date";

/** Actual recorded expenses only. Estimates never become cash spent automatically. */
export function recordedCost(task: Task): number {
  return task.status === "Completed" && task.actualCost != null && Number.isFinite(task.actualCost)
    ? Math.max(0, task.actualCost)
    : 0;
}

export function completionDate(task: Task): Date | null {
  const raw = task.dateCompleted?.start;
  if (!raw) return null;
  const isCalendarDay = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const instant = isCalendarDay ? null : new Date(raw);
  if (instant && Number.isNaN(instant.getTime())) return null;
  // Notion date-only values are household calendar dates. Legacy instants belong
  // to the date at the house, regardless of the server's timezone.
  const key = isCalendarDay ? raw : householdDateKey(instant!);
  const date = new Date(`${key}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function summarizeSpending(tasks: Task[], now = new Date()) {
  const expenses = tasks.filter((task) => recordedCost(task) > 0);
  const dated = expenses.filter((task) => completionDate(task) != null);
  const undated = expenses.filter((task) => completionDate(task) == null);
  const calendarNow = householdCalendarNow(now);
  const yearStart = new Date(calendarNow.getFullYear(), 0, 1);
  const isRecordedByNow = (task: Task) => {
    const raw = task.dateCompleted?.start;
    return !raw || /^\d{4}-\d{2}-\d{2}$/.test(raw) || new Date(raw).getTime() <= now.getTime();
  };
  const sum = (rows: Task[]) => rows.reduce((total, task) => total + recordedCost(task), 0);
  const thisYear = dated.filter((task) => {
    const date = completionDate(task)!;
    return date >= yearStart && date <= calendarNow && isRecordedByNow(task);
  });
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(calendarNow.getFullYear(), calendarNow.getMonth() + index - 11, 1);
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const rows = dated.filter((task) => {
      const date = completionDate(task)!;
      return date >= month && date < nextMonth && date <= calendarNow && isRecordedByNow(task);
    });
    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      label: month.toLocaleDateString("en-US", { month: "short" }),
      value: sum(rows),
    };
  });
  return {
    expenses,
    dated,
    undated,
    thisYear,
    total: sum(expenses),
    yearTotal: sum(thisYear),
    undatedTotal: sum(undated),
    months,
    completedWithoutActualCost: tasks.filter((task) => task.status === "Completed" && task.actualCost == null),
  };
}
