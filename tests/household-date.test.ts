import { describe, expect, it } from "vitest";
import {
  calendarDateKey,
  householdCalendarNow,
  householdDateKey,
} from "../lib/household-date";
import { localDateKey } from "../lib/home-plan";

describe("the Braim Rd household calendar", () => {
  it("keeps the prior household day after UTC midnight", () => {
    const instant = new Date("2026-10-18T00:30:00Z");
    expect(householdDateKey(instant)).toBe("2026-10-17");
    expect(localDateKey(instant)).toBe("2026-10-17");
    expect(householdDateKey(new Date("2026-10-18T04:00:00Z"))).toBe(
      "2026-10-18",
    );
  });

  it("uses the daylight-saving offset before and after the spring transition", () => {
    expect(householdDateKey(new Date("2026-03-08T04:30:00Z"))).toBe(
      "2026-03-07",
    );
    expect(householdDateKey(new Date("2026-03-08T05:00:00Z"))).toBe(
      "2026-03-08",
    );
    expect(householdDateKey(new Date("2026-03-09T04:00:00Z"))).toBe(
      "2026-03-09",
    );
  });

  it("uses the daylight-saving offset before and after the autumn transition", () => {
    expect(householdDateKey(new Date("2026-11-01T04:00:00Z"))).toBe(
      "2026-11-01",
    );
    expect(householdDateKey(new Date("2026-11-02T04:30:00Z"))).toBe(
      "2026-11-01",
    );
    expect(householdDateKey(new Date("2026-11-02T05:00:00Z"))).toBe(
      "2026-11-02",
    );
  });

  it("anchors calendar arithmetic to home today without shifting chosen dates", () => {
    const anchor = householdCalendarNow(new Date("2026-10-18T00:30:00Z"));
    expect(calendarDateKey(anchor)).toBe("2026-10-17");
    expect(anchor.getHours()).toBe(0);
    anchor.setDate(anchor.getDate() + 7);
    expect(calendarDateKey(anchor)).toBe("2026-10-24");
    expect(calendarDateKey(new Date(2026, 0, 31))).toBe("2026-01-31");
  });

  it("calculates a seven-day window correctly across either daylight-saving change", () => {
    for (const [instant, expected] of [
      ["2026-03-05T04:30:00Z", "2026-03-11"],
      ["2026-10-29T04:30:00Z", "2026-11-05"],
    ]) {
      const cutoff = householdCalendarNow(new Date(instant));
      cutoff.setDate(cutoff.getDate() + 7);
      expect(calendarDateKey(cutoff)).toBe(expected);
    }
  });
});
