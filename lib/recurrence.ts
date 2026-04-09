import type { Frequency, Task } from "./types";

export function advanceDate(dateStr: string, frequency: Frequency): string {
  const d = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "Monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "Quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "Semi-annually":
      d.setMonth(d.getMonth() + 6);
      break;
    case "Annually":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}

/**
 * Generate virtual recurring task instances within a date range.
 * Returns projected copies of the task with advanced due dates.
 */
export function generateOccurrences(
  task: Task,
  rangeStart: string,
  rangeEnd: string
): Task[] {
  if (
    !task.frequency ||
    task.frequency === "One-time" ||
    task.status === "Completed" ||
    !task.dueDate
  ) {
    return [];
  }

  const occurrences: Task[] = [];
  let cursor = advanceDate(task.dueDate.start, task.frequency);

  // Project forward up to 50 iterations (safety cap)
  for (let i = 0; i < 50; i++) {
    if (cursor > rangeEnd) break;
    if (cursor >= rangeStart) {
      const duration =
        task.dueDate.end
          ? advanceDate(task.dueDate.end, task.frequency)
          : undefined;
      occurrences.push({
        ...task,
        id: `${task.id}_recur_${cursor}`,
        dueDate: { start: cursor, ...(duration ? { end: duration } : {}) },
      });
    }
    cursor = advanceDate(cursor, task.frequency);
  }

  return occurrences;
}
