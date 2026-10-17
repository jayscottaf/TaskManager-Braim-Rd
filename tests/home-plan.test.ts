import { describe, expect, it } from "vitest";
import type { Task } from "../lib/types";
import {
  addToHomePlan,
  emptyHomePlan,
  estimateTaskMinutes,
  isOverdueDeadline,
  localDateKey,
  normalizeHomePlan,
  planSuggestions,
  reconcileHomePlan,
  taskDateKey,
} from "../lib/home-plan";

function task(id: string, name: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    task: name,
    status: "Not Started",
    priority: null,
    area: null,
    subLocation: null,
    type: [],
    frequency: null,
    dueDate: null,
    dateCompleted: null,
    assignedTo: [],
    contractorVendor: null,
    costEstimate: null,
    actualCost: null,
    notes: null,
    tags: [],
    workMode: null,
    createdTime: "2026-10-01",
    ...overrides,
  };
}

describe("target dates and firm deadlines", () => {
  it("keeps missed hopes neutral, including existing dates without a deadline flag", () => {
    const mulch = task("mulch", "Put down mulch", {
      dueDate: { start: "2026-04-15" },
    });
    expect(isOverdueDeadline(mulch, "2026-10-17")).toBe(false);
    expect(
      isOverdueDeadline({ ...mulch, isDeadline: true }, "2026-10-17"),
    ).toBe(true);
    expect(
      isOverdueDeadline(
        { ...mulch, isDeadline: true, status: "Completed" },
        "2026-10-17",
      ),
    ).toBe(false);
    expect(
      isOverdueDeadline({ ...mulch, isDeadline: true }, "2026-04-15"),
    ).toBe(false);
  });

  it("compares date-only calendar days without timezone shifts", () => {
    const localMidnight = new Date("2026-10-17T00:05:00-04:00");
    expect(localDateKey(localMidnight)).toBe("2026-10-17");
    expect(
      taskDateKey(
        task("1", "Inspection", {
          dueDate: { start: "2026-10-17T23:00:00-04:00" },
        }),
      ),
    ).toBe("2026-10-17");
  });
});

describe("a saved, deliberately chosen plan", () => {
  it("restores budget, picks and custom durations, while expiring only Not today each local day", () => {
    const stored = {
      ...emptyHomePlan("2026-10-16"),
      budgetMinutes: 120,
      selectedIds: ["mulch"],
      skippedIds: ["paint"],
      estimates: { mulch: 60 },
    };
    const restored = normalizeHomePlan(stored, "2026-10-17");
    expect(restored.selectedIds).toEqual(["mulch"]);
    expect(restored.budgetMinutes).toBe(120);
    expect(restored.estimates).toEqual({ mulch: 60 });
    expect(restored.skippedIds).toEqual([]);
    expect(normalizeHomePlan(stored, "2026-10-16").skippedIds).toEqual([
      "paint",
    ]);
  });

  it("ignores incompatible and malformed saved data", () => {
    expect(
      normalizeHomePlan({ version: 2, selectedIds: ["1"] }, "2026-10-17"),
    ).toEqual(emptyHomePlan("2026-10-17"));
    expect(
      normalizeHomePlan(
        {
          version: 1,
          selectedIds: ["1", "1", null, "2", "3", "4"],
          budgetMinutes: -1,
          estimates: { broken: -10, valid: 90 },
        },
        "2026-10-17",
      ),
    ).toMatchObject({
      budgetMinutes: 30,
      selectedIds: ["1", "2", "3"],
      estimates: { valid: 90 },
    });
  });

  it("releases deleted picks while keeping completed picks for the finished-plan state", () => {
    const plan = {
      ...emptyHomePlan(),
      selectedIds: ["deleted1", "deleted2", "deleted3"],
    };
    const available = task("available", "Check filters");
    const cleaned = reconcileHomePlan(plan, [available]);
    expect(cleaned.selectedIds).toEqual([]);
    expect(addToHomePlan(cleaned, "available").selectedIds).toEqual([
      "available",
    ]);
    const finished = { ...emptyHomePlan(), selectedIds: ["done"] };
    expect(
      reconcileHomePlan(finished, [
        task("done", "Test alarm", { status: "Completed" }),
      ]),
    ).toBe(finished);
  });

  it("caps deliberate selections at three, without duplicating or automatically adding suggestions", () => {
    let plan = emptyHomePlan("2026-10-17");
    planSuggestions([task("1", "Test alarm")], plan, "2026-10-17");
    expect(plan.selectedIds).toEqual([]);
    for (const id of ["1", "1", "2", "3", "4"]) plan = addToHomePlan(plan, id);
    expect(plan.selectedIds).toEqual(["1", "2", "3"]);
  });
});

describe("useful recommendations without an AI request", () => {
  it("supports a genuine 15-minute task but never calls pressure washing a quick win", () => {
    const alarm = task("alarm", "Test smoke alarms", { costEstimate: 300 });
    const siding = task("siding", "Power wash siding", { costEstimate: 0 });
    expect(estimateTaskMinutes(alarm)).toBe(15);
    expect(estimateTaskMinutes(siding)).toBeGreaterThan(30);
    expect(
      planSuggestions(
        [siding, alarm],
        { ...emptyHomePlan(), budgetMinutes: 15 },
        "2026-10-17",
      ).map((item) => item.id),
    ).toEqual(["alarm"]);
  });

  it("excludes completed, paused, future and contractor work without changing stored dates", () => {
    const tasks = [
      task("done", "Test alarm", { status: "Completed" }),
      task("hold", "Test alarm", { status: "On Hold" }),
      task("future", "Test alarm", { dueDate: { start: "2027-01-01" } }),
      task("contractor", "Book an inspection", { workMode: "Contractor" }),
      task("available", "Check filters"),
    ];
    const before = structuredClone(tasks);
    expect(
      planSuggestions(tasks, emptyHomePlan(), "2026-10-17").map(
        (item) => item.id,
      ),
    ).toEqual(["available"]);
    expect(tasks).toEqual(before);
  });

  it("honors selected time, edited duration, max count and Not today together", () => {
    const tasks = [
      task("selected", "Clean floor"),
      task("skipped", "Check faucet"),
      task("first", "Check filter"),
      task("second", "Test alarm"),
      task("third", "Inspect gate"),
    ];
    const plan = {
      ...emptyHomePlan("2026-10-17"),
      selectedIds: ["selected"],
      skippedIds: ["skipped"],
      budgetMinutes: 45,
      estimates: { selected: 15 },
    };
    expect(
      planSuggestions(tasks, plan, "2026-10-17").map((item) => item.id),
    ).toEqual(["first", "third"]);
    expect(
      planSuggestions(
        tasks,
        { ...plan, estimates: { selected: 45 } },
        "2026-10-17",
      ),
    ).toEqual([]);
  });

  it("prioritizes actual deadlines without moving dates or automatically pinning them", () => {
    const tasks = [
      task("optional", "Check filter"),
      task("deadline", "Test alarm", {
        isDeadline: true,
        dueDate: { start: "2026-10-16" },
      }),
    ];
    const plan = { ...emptyHomePlan("2026-10-17"), budgetMinutes: 15 };
    expect(planSuggestions(tasks, plan, "2026-10-17")[0].id).toBe("deadline");
    expect(plan.selectedIds).toEqual([]);
    expect(tasks[1].dueDate?.start).toBe("2026-10-16");
  });
});
