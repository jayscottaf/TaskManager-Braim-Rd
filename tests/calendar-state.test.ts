import { describe, expect, it } from "vitest";
import { calendarDay, tasksOnCalendarDay } from "../lib/calendar-state";
import type { Task } from "../lib/types";

describe("local calendar dates", () => {
  it("rejects invalid or normalized dates supplied in URLs", () => {
    for (const value of [
      null,
      "not-a-date",
      "2026-02-30",
      "2026-13-01",
      "2026-10-17T00:00:00Z",
    ])
      expect(calendarDay(value)).toBeNull();
    expect(calendarDay("2028-02-29")?.getDate()).toBe(29);
  });
  it("keeps local midnight instead of shifting UTC dates", () => {
    const date = calendarDay("2026-10-17")!;
    expect([
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
    ]).toEqual([2026, 9, 17, 0]);
  });
  it("includes both ends of a task range and supports timestamp values", () => {
    const range = {
      id: "range",
      dueDate: { start: "2026-10-17", end: "2026-10-19" },
    } as Task;
    const timed = {
      id: "timed",
      dueDate: { start: "2026-10-17T23:00:00-04:00" },
    } as Task;
    expect(
      tasksOnCalendarDay([range, timed], "2026-10-17").map((task) => task.id),
    ).toEqual(["range", "timed"]);
    expect(tasksOnCalendarDay([range, timed], "2026-10-19")).toEqual([range]);
    expect(tasksOnCalendarDay([range, timed], "2026-10-20")).toEqual([]);
  });
});
