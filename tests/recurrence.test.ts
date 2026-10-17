import { describe, expect, it } from "vitest";
import { advanceDate, generateOccurrences, nextOccurrenceDate } from "../lib/recurrence";
import type { Task } from "../lib/types";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "mulch", task: "Mulch garden", status: "Not Started", priority: null, area: "Garden", subLocation: null,
    type: ["Landscaping"], frequency: "Monthly", dueDate: { start: "2024-01-31", end: "2024-02-02" },
    dateCompleted: null, assignedTo: [], contractorVendor: null, costEstimate: 0, actualCost: null, notes: null,
    tags: [], workMode: "DIY", createdTime: "2024-01-01T00:00:00Z", ...overrides,
  };
}

describe("calendar recurrence", () => {
  it("clamps month-end without skipping February or shifting across time zones", () => {
    expect(advanceDate("2024-01-31", "Monthly")).toBe("2024-02-29");
    expect(advanceDate("2025-01-31", "Monthly")).toBe("2025-02-28");
    expect(advanceDate("2024-02-29", "Annually")).toBe("2025-02-28");
    expect(advanceDate("2024-01-31", "Quarterly")).toBe("2024-04-30");
    expect(advanceDate("2024-02-30", "Monthly")).toBe("");
  });

  it("keeps the original month-end anchor across persisted successors", () => {
    const first = task();
    const next = nextOccurrenceDate(first);
    expect(next).toEqual({ start: "2024-02-29", end: "2024-03-02" });
    expect(nextOccurrenceDate({ ...first, dueDate: next, recurrenceAnchor: first.dueDate })).toEqual({ start: "2024-03-31", end: "2024-04-02" });
  });

  it("advances each range endpoint for every virtual occurrence", () => {
    const dates = generateOccurrences(task(), "2024-02-01", "2024-05-31").map((item) => item.dueDate);
    expect(dates).toEqual([
      { start: "2024-02-29", end: "2024-03-02" },
      { start: "2024-03-31", end: "2024-04-02" },
      { start: "2024-04-30", end: "2024-05-02" },
      { start: "2024-05-31", end: "2024-06-02" },
    ]);
    expect(dates.every((date) => !date?.end || date.end >= date.start)).toBe(true);
  });

  it("projects only dates after the current persisted occurrence", () => {
    const source = task({ dueDate: { start: "2024-03-31", end: "2024-04-02" }, recurrenceAnchor: { start: "2024-01-31", end: "2024-02-02" } });
    expect(generateOccurrences(source, "2024-01-01", "2024-05-31").map((item) => item.dueDate?.start)).toEqual(["2024-04-30", "2024-05-31"]);
    expect(generateOccurrences({ ...source, status: "Completed" }, "2024-01-01", "2024-12-31")).toEqual([]);
  });
});
