import { format, parseISO } from "date-fns";
import type { Task } from "@/lib/types";

/** Explain the saved result without making the successor look like unfinished work. */
export function completionNotice(nextOccurrence?: Pick<Task, "dueDate"> | null): string {
  const nextDate = nextOccurrence?.dueDate?.start?.slice(0, 10);
  return nextDate
    ? `Completed. Next repeat: ${format(parseISO(nextDate), "MMM d, yyyy")}.`
    : "Task completed.";
}
