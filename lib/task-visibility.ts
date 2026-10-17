import { householdDateKey } from "./household-date";
import type { Task } from "./types";

/** Unstarted optional maintenance can wait; ongoing work and firm deadlines stay visible. */
export function isUpcomingRepeat(
  task: Task,
  today = householdDateKey(),
): boolean {
  return (
    task.status === "Not Started" &&
    task.isDeadline !== true &&
    task.frequency != null &&
    task.frequency !== "One-time" &&
    Boolean(task.dueDate && task.dueDate.start.slice(0, 10) > today)
  );
}

/** Completion is saved even when scheduling its next occurrence needs a retry. */
export function repeatsNeedingAttention(tasks: Task[]): Task[] {
  return tasks.filter(
    (task) => task.status === "Completed" && task.nextOccurrencePending === true,
  );
}

/** Preserve every record, including duplicate-looking ones, when grouping the list. */
export function groupTaskVisibility(tasks: Task[], today = householdDateKey()) {
  const current: Task[] = [];
  const upcomingRepeats: Task[] = [];
  for (const task of tasks) {
    (isUpcomingRepeat(task, today) ? upcomingRepeats : current).push(task);
  }
  return { current, upcomingRepeats };
}
