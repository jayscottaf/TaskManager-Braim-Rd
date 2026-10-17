/** Braim Rd's calendar day stays consistent on the server, at home, and while away. */
export const HOUSEHOLD_TIME_ZONE = "America/New_York";

const householdDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: HOUSEHOLD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Convert a real instant to the home's date, including daylight-saving changes. */
export function householdDateKey(date = new Date()): string {
  const parts = householdDayFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Format an already chosen calendar date without interpreting it as an instant. */
export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Local date components for date-fns/calendar arithmetic; this is not a timestamp. */
export function householdCalendarNow(date = new Date()): Date {
  const [year, month, day] = householdDateKey(date).split("-").map(Number);
  return new Date(year, month - 1, day);
}
