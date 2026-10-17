import type { PhotoClassification } from "./ai";
import type { Task, UpdateTaskInput } from "./types";
import { AREAS, PRIORITIES, TASK_TYPES } from "./types";
import { parseTaskNotes, serializeTaskNotes, type TaskNotes } from "./task-notes";

export interface TaskDraft {
  name: string;
  status: Task["status"];
  priority: NonNullable<Task["priority"]> | "";
  workMode: NonNullable<Task["workMode"]> | "";
  area: NonNullable<Task["area"]> | "";
  subLocation: string;
  types: Task["type"];
  frequency: NonNullable<Task["frequency"]> | "";
  date: string;
  endDate: string;
  completedDate: string;
  isDeadline: boolean;
  contractor: string;
  estimate: string;
  actual: string;
  notes: string;
  tags: string[];
  photos: string[];
}

export function initialTaskDraft(task?: Partial<Task>): TaskDraft {
  const notes = parseTaskNotes(task?.notes);
  return {
    name: task?.task ?? "", status: task?.status ?? "Not Started",
    priority: task?.priority ?? "", workMode: task?.workMode ?? "", area: task?.area ?? "",
    subLocation: task?.subLocation ?? "", types: task?.type ?? [], frequency: task?.frequency ?? "",
    date: task?.dueDate?.start ?? "", endDate: task?.dueDate?.end ?? "", completedDate: task?.dateCompleted?.start ?? "", isDeadline: task?.isDeadline ?? false,
    contractor: task?.contractorVendor ?? "", estimate: task?.costEstimate?.toString() ?? "",
    actual: task?.actualCost?.toString() ?? "", notes: notes.text, tags: task?.tags ?? [], photos: notes.photos,
  };
}

/** Suggestions may fill gaps; explicit user input, including a cleared value, always wins. */
export function mergePhotoSuggestions(draft: TaskDraft, suggestion: PhotoClassification, touched: Set<keyof TaskDraft>): TaskDraft {
  const next = { ...draft };
  if (!touched.has("name") && !draft.name.trim() && typeof suggestion.task === "string" && suggestion.task.trim()) next.name = suggestion.task.trim();
  if (!touched.has("area") && !draft.area && AREAS.includes(suggestion.area)) next.area = suggestion.area;
  if (!touched.has("priority") && !draft.priority && PRIORITIES.includes(suggestion.priority)) next.priority = suggestion.priority;
  if (!touched.has("types") && !draft.types.length && Array.isArray(suggestion.type)) next.types = suggestion.type.filter((type) => TASK_TYPES.includes(type));
  if (!touched.has("estimate") && !draft.estimate && Number.isFinite(suggestion.costEstimate) && suggestion.costEstimate >= 0) next.estimate = String(suggestion.costEstimate);
  return next;
}

export function draftUpdate(draft: TaskDraft, attachments: TaskNotes, status = draft.status, afterPhoto?: string | null): UpdateTaskInput {
  const notes = serializeTaskNotes({
    text: draft.notes, photos: draft.photos,
    afterPhotos: [...attachments.afterPhotos, ...(afterPhoto ? [afterPhoto] : [])],
    analysis: attachments.analysis,
  });
  return {
    task: draft.name.trim(), status, priority: draft.priority || null, area: draft.area || null,
    subLocation: draft.subLocation.trim() || null, type: draft.types, frequency: draft.frequency || null,
    dueDate: draft.date ? { start: draft.date, ...(draft.endDate ? { end: draft.endDate } : {}) } : null,
    dateCompleted: draft.completedDate ? { start: draft.completedDate } : null,
    isDeadline: !!draft.date && draft.isDeadline,
    contractorVendor: draft.contractor.trim() || null,
    costEstimate: draft.estimate.trim() === "" ? null : Number(draft.estimate),
    actualCost: draft.actual.trim() === "" ? null : Number(draft.actual),
    notes: notes || null, tags: draft.tags, workMode: draft.workMode || null,
  };
}

export function validateTaskDraft(draft: TaskDraft): string | null {
  if (!draft.name.trim()) return "Give your task a name.";
  if (draft.endDate && (!draft.date || draft.endDate < draft.date)) return "The end date must be on or after the planned date.";
  for (const value of [draft.estimate, draft.actual]) {
    if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0)) return "Enter a cost of zero or more, or leave it blank.";
  }
  return null;
}

/** A saved completion with pending recurrence must be retried as Completed, never reopened. */
export function recoverPendingCompletion(draft: TaskDraft, body: unknown, taskId: string): TaskDraft | null {
  if (!body || typeof body !== "object") return null;
  const partial = body as Record<string, unknown>;
  if (partial.saved !== true || partial.recurrencePending !== true || !partial.task || typeof partial.task !== "object") return null;
  const saved = partial.task as Record<string, unknown>;
  if (saved.id !== taskId || saved.status !== "Completed") return null;
  let completedDate = draft.completedDate;
  if (saved.dateCompleted === null) completedDate = "";
  else if (saved.dateCompleted && typeof saved.dateCompleted === "object") {
    const start = (saved.dateCompleted as Record<string, unknown>).start;
    if (typeof start === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(start)) completedDate = start.slice(0, 10);
  }
  return { ...draft, status: "Completed", completedDate };
}
