import type { TaskAnalysis } from "./ai";
import type { Task } from "./types";
import { parseTaskNotes } from "./task-notes";

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function range(value: unknown): boolean { return record(value) && typeof value.low === "number" && typeof value.high === "number" && Number.isFinite(value.low) && Number.isFinite(value.high) && value.low >= 0 && value.high >= value.low; }
export function isTaskAnalysis(value: unknown): value is TaskAnalysis {
  if (!record(value)) return false;
  const { diyGuidance: diy, costSanityCheck: cost, contractorAdvice: contractor } = value;
  return record(diy) && ["DIY", "Hire a pro", "Either works"].includes(String(diy.recommendation)) && typeof diy.reasoning === "string" && strings(diy.steps) && strings(diy.materials)
    && record(cost) && typeof cost.estimateIsReasonable === "boolean" && range(cost.expectedRange) && typeof cost.note === "string" && (cost.neglectCost === null || range(cost.neglectCost)) && typeof cost.neglectNote === "string"
    && record(contractor) && typeof contractor.tradeType === "string" && strings(contractor.questionsToAsk) && strings(contractor.redFlags);
}

/** Only user-authored inputs affect analysis, never the generated output itself. */
export function taskAnalysisInput(task: Task): Task {
  return { ...task, notes: parseTaskNotes(task.notes).text.slice(0, 4000) || null };
}
