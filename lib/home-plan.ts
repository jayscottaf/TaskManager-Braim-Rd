import type { Task } from "./types";
import { householdDateKey } from "./household-date";

export const PLAN_STORAGE_KEY = "braim:home-plan:v1";
export const PLAN_CHANGED_EVENT = "braim:home-plan-changed";
export const MAX_PLAN_TASKS = 3;

export interface HomePlan {
  version: 1;
  budgetMinutes: number;
  selectedIds: string[];
  skippedDate: string;
  skippedIds: string[];
  estimates: Record<string, number>;
}

/** Household day shared by server rendering and the phone, including while away. */
export function localDateKey(date = new Date()): string {
  return householdDateKey(date);
}

export function taskDateKey(task: Task): string | undefined {
  return task.dueDate?.start.slice(0, 10);
}

export function isOverdueDeadline(task: Task, today = localDateKey()): boolean {
  return (
    task.status !== "Completed" &&
    task.isDeadline === true &&
    Boolean(taskDateKey(task) && taskDateKey(task)! < today)
  );
}

export function emptyHomePlan(today = localDateKey()): HomePlan {
  return {
    version: 1,
    budgetMinutes: 30,
    selectedIds: [],
    skippedDate: today,
    skippedIds: [],
    estimates: {},
  };
}

export function normalizeHomePlan(
  value: unknown,
  today = localDateKey(),
): HomePlan {
  const fallback = emptyHomePlan(today);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1
  )
    return fallback;
  const plan = value as Partial<HomePlan>;
  const ids = (input: unknown): string[] =>
    Array.isArray(input)
      ? [...new Set(input.filter((id): id is string => typeof id === "string"))]
      : [];
  const estimates = Object.fromEntries(
    Object.entries(plan.estimates ?? {}).filter(
      ([, minutes]) =>
        Number.isFinite(minutes) && minutes >= 5 && minutes <= 1440,
    ),
  );
  return {
    version: 1,
    budgetMinutes:
      Number.isFinite(plan.budgetMinutes) &&
      plan.budgetMinutes! >= 10 &&
      plan.budgetMinutes! <= 480
        ? Math.round(plan.budgetMinutes!)
        : 30,
    selectedIds: ids(plan.selectedIds).slice(0, MAX_PLAN_TASKS),
    skippedDate: today,
    skippedIds: plan.skippedDate === today ? ids(plan.skippedIds) : [],
    estimates,
  };
}

export function readHomePlan(): HomePlan {
  try {
    return normalizeHomePlan(
      JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? "null"),
    );
  } catch {
    return emptyHomePlan();
  }
}

export function saveHomePlan(plan: HomePlan): void {
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
}

export function addToHomePlan(plan: HomePlan, id: string): HomePlan {
  if (
    plan.selectedIds.includes(id) ||
    plan.selectedIds.length >= MAX_PLAN_TASKS
  )
    return plan;
  return {
    ...plan,
    selectedIds: [...plan.selectedIds, id],
    skippedIds: plan.skippedIds.filter((item) => item !== id),
  };
}

/** Conservative, editable estimates. Never infer job duration from its dollar cost. */
export function estimateTaskMinutes(task: Task): number {
  const title = task.task.toLowerCase();
  if (
    /\b(power|pressure)\s*wash|\bmulch\b|\b(paint|repaint|stain|seal)\b/.test(
      title,
    )
  )
    return 120;
  if (
    /water damage|drywall|chimney|\b(install|repair|replace)\b/.test(title) &&
    !/\b(filter|battery|batteries|bulb)\b/.test(title)
  )
    return 120;
  if (/\b(clean|wash)\b/.test(title)) return 60;
  if (/\b(call|book|schedule|request|measure|check|test|inspect)\b/.test(title))
    return 15;
  if (/\b(filter|battery|batteries)\b/.test(title)) return 15;
  if (/\bbulbs?\b/.test(title))
    return /\b(1[0-9]|[2-9][0-9]|all|large)\b/.test(title) ? 45 : 15;
  return 45;
}

export function planSuggestions(
  tasks: Task[],
  plan: HomePlan,
  today = localDateKey(),
): Task[] {
  const selected = new Set(plan.selectedIds);
  const skipped = new Set(plan.skippedDate === today ? plan.skippedIds : []);
  const committed = tasks
    .filter((task) => selected.has(task.id) && task.status !== "Completed")
    .reduce(
      (sum, task) =>
        sum + (plan.estimates[task.id] ?? estimateTaskMinutes(task)),
      0,
    );
  let remaining = Math.max(0, plan.budgetMinutes - committed);
  return tasks
    .filter(
      (task) =>
        task.status !== "Completed" &&
        task.status !== "On Hold" &&
        task.workMode !== "Contractor" &&
        !selected.has(task.id) &&
        !skipped.has(task.id) &&
        (!taskDateKey(task) || taskDateKey(task)! <= today),
    )
    .sort((a, b) => {
      const deadlineDifference =
        Number(isOverdueDeadline(b, today)) -
        Number(isOverdueDeadline(a, today));
      if (deadlineDifference) return deadlineDifference;
      const todayDifference =
        Number(taskDateKey(b) === today) - Number(taskDateKey(a) === today);
      if (todayDifference) return todayDifference;
      const progressDifference =
        Number(b.status === "In Progress") - Number(a.status === "In Progress");
      if (progressDifference) return progressDifference;
      return a.task.localeCompare(b.task) || a.id.localeCompare(b.id);
    })
    .filter((task) => {
      const minutes = plan.estimates[task.id] ?? estimateTaskMinutes(task);
      if (minutes > remaining) return false;
      remaining -= minutes;
      return true;
    })
    .slice(0, Math.max(0, MAX_PLAN_TASKS - plan.selectedIds.length));
}

/** Loaded tasks include completed work, so only deleted/missing picks are removed. */
export function reconcileHomePlan(plan: HomePlan, tasks: Task[]): HomePlan {
  const existing = new Set(tasks.map((task) => task.id));
  const selectedIds = plan.selectedIds.filter((id) => existing.has(id));
  return selectedIds.length === plan.selectedIds.length
    ? plan
    : { ...plan, selectedIds };
}
