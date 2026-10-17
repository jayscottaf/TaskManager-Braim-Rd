import { AREAS, FREQUENCIES, PRIORITIES, STATUSES, TASK_TYPES, type CreateTaskInput, type UpdateTaskInput } from "@/lib/types";

type Result<T> = { input: T; error?: never } | { input?: never; error: string };

function validDate(value: unknown): value is { start: string; end?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const date = value as Record<string, unknown>;
  const validDay = (day: unknown): day is string => {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const parsed = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
  };
  return validDay(date.start) && (date.end === undefined || (validDay(date.end) && date.end >= date.start));
}

export function validateTaskInput(body: unknown, mode: "create"): Result<CreateTaskInput>;
export function validateTaskInput(body: unknown, mode: "update"): Result<UpdateTaskInput>;
export function validateTaskInput(body: unknown, mode: "create" | "update"): Result<CreateTaskInput | UpdateTaskInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Task details must be an object" };
  const source = body as Record<string, unknown>;
  const input: Record<string, unknown> = {};
  if (mode === "create" || source.task !== undefined) {
    if (typeof source.task !== "string" || !source.task.trim()) return { error: "Task name is required" };
    if (source.task.trim().length > 2000) return { error: "Task name is too long" };
    input.task = source.task.trim();
  }
  const enums = { status: STATUSES, priority: PRIORITIES, area: AREAS, frequency: FREQUENCIES, workMode: ["DIY", "Contractor"] };
  for (const [key, allowed] of Object.entries(enums)) {
    const value = source[key];
    if (value === undefined) continue;
    if (value === null && key !== "status") input[key] = null;
    else if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) return { error: `Invalid ${key}` };
    else input[key] = value;
  }
  for (const key of ["subLocation", "contractorVendor", "notes"]) {
    const value = source[key];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== "string" || value.length > (key === "notes" ? 180000 : 2000))) return { error: `Invalid ${key}` };
    input[key] = value;
  }
  for (const key of ["costEstimate", ...(mode === "update" ? ["actualCost"] : [])]) {
    const value = source[key];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) return { error: `Invalid ${key}: enter a non-negative amount` };
    input[key] = value;
  }
  for (const key of ["dueDate", ...(mode === "update" ? ["dateCompleted"] : [])]) {
    const value = source[key];
    if (value === undefined) continue;
    if (value !== null && !validDate(value)) return { error: `Invalid ${key}: choose a valid date and range` };
    input[key] = value === null ? null : { start: value.start, ...(value.end ? { end: value.end } : {}) };
  }
  for (const key of ["type", "tags"]) {
    const value = source[key];
    if (value === undefined) continue;
    if (!Array.isArray(value) || value.length > 100 || !value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 100)) return { error: `Invalid ${key}` };
    if (key === "type" && !value.every((item) => TASK_TYPES.includes(item))) return { error: "Invalid task type" };
    input[key] = [...new Set(value.map((item: string) => item.trim()))];
  }
  if (source.isDeadline !== undefined) {
    if (typeof source.isDeadline !== "boolean") return { error: "Invalid deadline setting" };
    input.isDeadline = source.isDeadline;
  }
  if (input.dueDate === null) input.isDeadline = false;
  if (!Object.keys(input).length) return { error: "No task changes supplied" };
  return { input: input as unknown as CreateTaskInput | UpdateTaskInput };
}
