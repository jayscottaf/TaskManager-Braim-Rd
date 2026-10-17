import { createTask, findNextOccurrence, getTask, updateTask, withTaskMutation } from "@/lib/notion";
import { nextOccurrenceDate } from "@/lib/recurrence";
import { householdDateKey } from "@/lib/household-date";
import type { Task, UpdateTaskInput } from "@/lib/types";

export class RecurrencePendingError extends Error {
  constructor(public readonly task: Task) {
    super("Your task was saved, but its next occurrence could not be scheduled. Retry completion to finish scheduling it.");
  }
}

/** Save the task first; persist retry intent in the same write as completion. */
export async function updateTaskWithRecurrence(id: string, input: UpdateTaskInput): Promise<Task & { nextOccurrence?: Task }> {
  return withTaskMutation(id, async () => {
    const current = await getTask(id, { bypassCache: true });
    const changes = { ...input };
    const completionRequested = input.status === "Completed";
    const completing = completionRequested && current.status !== "Completed";
    let pending = current.nextOccurrencePending ?? false;
    if (completionRequested) {
      if (completing) {
        // Editing completed history must preserve undated records and explicit clears.
        changes.dateCompleted = input.dateCompleted ?? current.dateCompleted ?? { start: householdDateKey() };
        const dateChanged = input.dueDate !== undefined && (input.dueDate?.start !== current.dueDate?.start || input.dueDate?.end !== current.dueDate?.end);
        const recurrenceAnchor = dateChanged ? input.dueDate : current.recurrenceAnchor;
        pending = nextOccurrenceDate({ ...current, ...input, recurrenceAnchor }) !== null;
      }
    } else if (input.status !== undefined) {
      changes.dateCompleted = null;
      pending = false;
    }
    const task = await updateTask(id, changes, { nextOccurrencePending: pending, currentTask: current });
    if (!completionRequested || !pending) return task;

    try {
      // Identity is independent of edited title/date and survives a lost create response.
      let nextOccurrence = await findNextOccurrence(id);
      if (!nextOccurrence) {
        const dueDate = nextOccurrenceDate(task);
        if (dueDate) {
          nextOccurrence = await createTask({
            task: task.task,
            status: "Not Started",
            priority: task.priority,
            area: task.area,
            subLocation: task.subLocation,
            type: task.type,
            frequency: task.frequency,
            dueDate,
            isDeadline: task.isDeadline ?? false,
            contractorVendor: task.contractorVendor,
            costEstimate: task.costEstimate,
            notes: task.notes,
            tags: task.tags,
            workMode: task.workMode,
          }, { sourceId: id, anchor: task.recurrenceAnchor ?? task.dueDate! });
        }
      }
      const saved = await updateTask(id, {}, { nextOccurrencePending: false });
      return { ...saved, ...(nextOccurrence ? { nextOccurrence } : {}) };
    } catch (error) {
      console.error("Next occurrence scheduling failed:", error);
      throw new RecurrencePendingError(task);
    }
  });
}
