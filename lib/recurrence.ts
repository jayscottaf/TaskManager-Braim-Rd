import type { Frequency, Task } from "./types";

const MONTHS: Record<Frequency, number> = {
  "One-time": 0,
  Monthly: 1,
  Quarterly: 3,
  "Semi-annually": 6,
  Annually: 12,
};

/** Calendar arithmetic uses UTC components, never local/UTC conversion of midnight. */
export function advanceDate(dateStr: string, frequency: Frequency, steps = 1): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(dateStr);
  if (!match || !Number.isInteger(steps) || steps < 0) return "";
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const original = new Date(Date.UTC(year, month, day));
  if (original.getUTCFullYear() !== year || original.getUTCMonth() !== month || original.getUTCDate() !== day) return "";
  const months = MONTHS[frequency];
  if (months === undefined) return "";
  const target = new Date(Date.UTC(year, month + months * steps, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

type TaskDate = NonNullable<Task["dueDate"]>;

/** Use the original anchor on every step so Jan 31 → Feb 28 → Mar 31. */
export function nextOccurrenceDate(task: Pick<Task, "dueDate" | "frequency" | "recurrenceAnchor">): TaskDate | null {
  if (!task.dueDate?.start || !task.frequency || task.frequency === "One-time") return null;
  const anchor = task.recurrenceAnchor ?? task.dueDate;
  for (let step = 1; step <= 1200; step++) {
    const start = advanceDate(anchor.start, task.frequency, step);
    if (!start) return null;
    if (start > task.dueDate.start.slice(0, 10)) {
      const end = anchor.end ? advanceDate(anchor.end, task.frequency, step) : undefined;
      return { start, ...(end && end >= start ? { end } : {}) };
    }
  }
  return null;
}

/** Generate projected dates from one anchor, advancing both ends of date ranges. */
export function generateOccurrences(task: Task, rangeStart: string, rangeEnd: string): Task[] {
  if (!task.frequency || task.frequency === "One-time" || task.status === "Completed" || !task.dueDate?.start) return [];
  const anchor = task.recurrenceAnchor ?? task.dueDate;
  const occurrences: Task[] = [];
  for (let step = 1; step <= 1200; step++) {
    const start = advanceDate(anchor.start, task.frequency, step);
    if (!start || start > rangeEnd) break;
    if (start <= task.dueDate.start.slice(0, 10) || start < rangeStart) continue;
    const end = anchor.end ? advanceDate(anchor.end, task.frequency, step) : undefined;
    occurrences.push({
      ...task,
      id: `${task.id}_recur_${start}`,
      dueDate: { start, ...(end && end >= start ? { end } : {}) },
    });
  }
  return occurrences;
}
