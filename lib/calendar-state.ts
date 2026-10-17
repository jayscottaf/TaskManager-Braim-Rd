import type { Task } from "./types";

/** Validate calendar input before parsing it as a local date. */
export function calendarDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : null;
}

export function tasksOnCalendarDay(tasks: Task[], day: string): Task[] {
  return tasks.filter((task) => {
    const start = task.dueDate?.start.slice(0, 10);
    const end = task.dueDate?.end?.slice(0, 10) ?? start;
    return Boolean(start && end && start <= day && end >= day);
  });
}
