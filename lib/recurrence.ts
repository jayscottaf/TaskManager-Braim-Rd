import type { Frequency } from "./types";

export function advanceDate(dateStr: string, frequency: Frequency): string {
  const d = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "Monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "Quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "Semi-annually":
      d.setMonth(d.getMonth() + 6);
      break;
    case "Annually":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}
