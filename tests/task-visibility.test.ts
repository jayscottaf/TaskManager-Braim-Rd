import { describe, expect, it } from "vitest";
import { groupTaskVisibility, isUpcomingRepeat, repeatsNeedingAttention } from "../lib/task-visibility";
import type { Task } from "../lib/types";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    task: "Inspect roof",
    status: "Not Started",
    priority: "High",
    area: "Roof",
    subLocation: null,
    type: [],
    frequency: "Annually",
    dueDate: { start: "2027-04-15" },
    dateCompleted: null,
    assignedTo: [],
    contractorVendor: null,
    costEstimate: null,
    actualCost: null,
    notes: null,
    tags: [],
    workMode: "DIY",
    createdTime: "2026-10-17T17:00:00Z",
    ...overrides,
  };
}

describe("current work and upcoming repeats", () => {
  it("keeps earlier hopeful dates visible and tucks next year's maintenance away", () => {
    const earlier = task("earlier", { dueDate: { start: "2026-04-15" } });
    const nextYear = task("next-year");
    const undated = task("undated", { dueDate: null });
    const groups = groupTaskVisibility([nextYear, earlier, undated], "2026-10-17");

    expect(groups.current.map((item) => item.id)).toEqual(["earlier", "undated"]);
    expect(groups.upcomingRepeats.map((item) => item.id)).toEqual(["next-year"]);
  });

  it("returns a repeat to current work on its planned household day", () => {
    const inspection = task("inspection", {
      dueDate: { start: "2026-10-17T23:00:00-04:00" },
    });
    expect(isUpcomingRepeat(inspection, "2026-10-16")).toBe(true);
    expect(isUpcomingRepeat(inspection, "2026-10-17")).toBe(false);
    expect(isUpcomingRepeat(inspection, "2026-10-18")).toBe(false);
  });

  it("keeps completed records in completion history and one-time future plans in the list", () => {
    const records = [
      task("completed", { status: "Completed" }),
      task("one-time", { frequency: "One-time" }),
      task("no-frequency", { frequency: null }),
    ];
    expect(groupTaskVisibility(records, "2026-10-17").current).toEqual(records);
    expect(groupTaskVisibility(records, "2026-10-17").upcomingRepeats).toEqual([]);
  });

  it("recognizes each recurring frequency without moving or deduplicating records", () => {
    const records = [
      task("annual-a"),
      task("annual-b"),
      task("monthly", { frequency: "Monthly" }),
      task("quarterly", { frequency: "Quarterly" }),
      task("semiannual", { frequency: "Semi-annually" }),
    ];
    const original = structuredClone(records);
    const groups = groupTaskVisibility(records, "2026-10-17");
    expect(groups.upcomingRepeats).toEqual(records);
    expect(groups.upcomingRepeats).toHaveLength(5);
    expect(records).toEqual(original);
  });

  it("keeps ongoing and paused work and firm deadlines visible even before their date", () => {
    const records = [
      task("ongoing", { status: "In Progress" }),
      task("paused", { status: "On Hold" }),
      task("deadline", { isDeadline: true }),
    ];
    expect(groupTaskVisibility(records, "2026-10-17").current).toEqual(records);
    expect(groupTaskVisibility(records, "2026-10-17").upcomingRepeats).toEqual([]);
  });

  it("surfaces saved completions awaiting their next repeat without reopening completed work", () => {
    const pending = task("pending", { status: "Completed", nextOccurrencePending: true });
    const completed = task("completed", { status: "Completed", nextOccurrencePending: false });
    const active = task("active", { nextOccurrencePending: true });
    const records = [pending, completed, active];
    const before = structuredClone(records);
    expect(repeatsNeedingAttention(records)).toEqual([pending]);
    expect(records).toEqual(before);
    expect(pending.status).toBe("Completed");
  });
});
