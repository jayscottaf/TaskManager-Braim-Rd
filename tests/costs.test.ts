import { describe, expect, it } from "vitest";
import { recordedCost, summarizeSpending } from "@/lib/costs";
import type { Task } from "@/lib/types";

const task = (changes: Partial<Task>): Task => ({ id: "task", task: "Mulch", status: "Completed", actualCost: null, costEstimate: null, dateCompleted: null, ...changes } as Task);
const now = new Date("2026-10-17T12:00:00");

describe("recorded household spending", () => {
  it("does not turn completion estimates or unfinished task costs into cash spent", () => {
    const summary = summarizeSpending([
      task({ costEstimate: 6800 }),
      task({ status: "Not Started", actualCost: 500, costEstimate: 500 }),
      task({ id: "paid", actualCost: 15, dateCompleted: { start: "2026-10-01" } }),
    ], now);
    expect(summary.total).toBe(15);
    expect(summary.yearTotal).toBe(15);
    expect(summary.completedWithoutActualCost).toHaveLength(1);
  });

  it("keeps undated expenses out of year and monthly totals instead of assigning today's date", () => {
    const summary = summarizeSpending([task({ actualCost: 15 })], now);
    expect(summary.total).toBe(15);
    expect(summary.undatedTotal).toBe(15);
    expect(summary.yearTotal).toBe(0);
    expect(summary.months.every((month) => month.value === 0)).toBe(true);
  });

  it("excludes future and outside-year dates from current totals", () => {
    const summary = summarizeSpending([
      task({ actualCost: 10, dateCompleted: { start: "2025-12-31" } }),
      task({ actualCost: 20, dateCompleted: { start: "2026-10-17" } }),
      task({ actualCost: 30, dateCompleted: { start: "2026-10-18" } }),
      task({ actualCost: 40, dateCompleted: { start: "2026-11-01" } }),
    ], now);
    expect(summary.yearTotal).toBe(20);
    expect(summary.months.at(-1)?.value).toBe(20);
    expect(summary.months.find((month) => month.key === "2025-12")?.value).toBe(10);
  });

  it("treats $0 as an actual recorded cost and does not substitute the estimate", () => {
    const row = task({ actualCost: 0, costEstimate: 100 });
    expect(recordedCost(row)).toBe(0);
    expect(summarizeSpending([row], now).completedWithoutActualCost).toHaveLength(0);
  });

  it("keeps New York's year and month before the UTC new-year boundary", () => {
    const summary = summarizeSpending([
      task({ actualCost: 15, dateCompleted: { start: "2026-12-31" } }),
      task({ actualCost: 25, dateCompleted: { start: "2027-01-01" } }),
      task({ actualCost: 35, dateCompleted: { start: "2027-01-01T01:00:00Z" } }),
      task({ actualCost: 45, dateCompleted: { start: "2027-01-01T05:30:00Z" } }),
      task({ actualCost: 55, dateCompleted: { start: "2027-01-01T02:30:00Z" } }),
    ], new Date("2027-01-01T02:00:00Z"));
    expect(summary.yearTotal).toBe(50);
    expect(summary.months.at(-1)).toMatchObject({ key: "2026-12", value: 50 });
    expect(summary.months.some((month) => month.key === "2027-01")).toBe(false);
  });

  it("converts legacy UTC completion instants to the household month", () => {
    const summary = summarizeSpending([
      task({ actualCost: 15, dateCompleted: { start: "2026-10-01T02:00:00Z" } }),
      task({ actualCost: 20, dateCompleted: { start: "2026-10-01" } }),
    ], new Date("2026-10-17T12:00:00Z"));
    expect(summary.months.find((month) => month.key === "2026-09")?.value).toBe(15);
    expect(summary.months.find((month) => month.key === "2026-10")?.value).toBe(20);
  });

});
