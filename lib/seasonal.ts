export interface SeasonalRule {
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  taskSuggestions: string[];
  area: string;
  types: string[];
}

// Saratoga Springs, NY — USDA Zone 4b/5a
export const SEASONAL_RULES: SeasonalRule[] = [
  {
    name: "Pool Opening",
    startMonth: 3, startDay: 25,
    endMonth: 5, endDay: 15,
    taskSuggestions: [
      "Remove pool cover and clean",
      "Check pool pump and filter",
      "Balance pool chemicals",
      "Inspect pool deck for damage",
    ],
    area: "Exterior",
    types: ["Cleaning", "General Repair"],
  },
  {
    name: "Spring Cleanup",
    startMonth: 4, startDay: 1,
    endMonth: 5, endDay: 1,
    taskSuggestions: [
      "Clean gutters (spring)",
      "Inspect exterior for winter damage",
      "Power wash siding and driveway",
      "Check window screens and seals",
    ],
    area: "Exterior",
    types: ["Cleaning", "General Repair"],
  },
  {
    name: "AC Service",
    startMonth: 4, startDay: 1,
    endMonth: 4, endDay: 30,
    taskSuggestions: [
      "Schedule AC tune-up",
      "Replace HVAC filters",
      "Clean AC condenser unit",
    ],
    area: "Basement/Attic",
    types: ["HVAC"],
  },
  {
    name: "Lawn Season",
    startMonth: 5, startDay: 1,
    endMonth: 10, endDay: 31,
    taskSuggestions: [
      "Mow lawn (monthly)",
      "Fertilize lawn",
      "Edge walkways and beds",
      "Trim hedges and shrubs",
    ],
    area: "Garden",
    types: ["Landscaping"],
  },
  {
    name: "Furnace Service",
    startMonth: 9, startDay: 1,
    endMonth: 9, endDay: 30,
    taskSuggestions: [
      "Schedule furnace tune-up",
      "Replace HVAC filters",
      "Check thermostat programming",
    ],
    area: "Basement/Attic",
    types: ["HVAC"],
  },
  {
    name: "Pool Closing",
    startMonth: 9, startDay: 15,
    endMonth: 10, endDay: 15,
    taskSuggestions: [
      "Winterize pool — drain lines",
      "Install pool cover",
      "Store pool equipment",
    ],
    area: "Exterior",
    types: ["General Repair"],
  },
  {
    name: "Fall Cleanup",
    startMonth: 10, startDay: 1,
    endMonth: 10, endDay: 31,
    taskSuggestions: [
      "Clean gutters (fall)",
      "Touch up exterior paint",
      "Rake leaves and clear beds",
      "Inspect roof for damage",
    ],
    area: "Exterior",
    types: ["Cleaning", "Painting"],
  },
  {
    name: "Winterize",
    startMonth: 10, startDay: 1,
    endMonth: 11, endDay: 1,
    taskSuggestions: [
      "Winterize outdoor faucets and hose bibs",
      "Drain and store garden hoses",
      "Insulate exposed pipes",
      "Check weatherstripping on doors/windows",
    ],
    area: "Exterior",
    types: ["Plumbing", "General Repair"],
  },
  {
    name: "Winter Prep",
    startMonth: 11, startDay: 1,
    endMonth: 11, endDay: 30,
    taskSuggestions: [
      "Check insulation in attic",
      "Test smoke and CO detectors",
      "Stock ice melt and snow supplies",
    ],
    area: "Basement/Attic",
    types: ["General Repair"],
  },
];

export function getActiveSeasons(date: Date = new Date()): SeasonalRule[] {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateNum = month * 100 + day;

  return SEASONAL_RULES.filter((rule) => {
    const start = rule.startMonth * 100 + rule.startDay;
    const end = rule.endMonth * 100 + rule.endDay;
    return dateNum >= start && dateNum <= end;
  });
}

export function getUpcomingSeasons(
  date: Date = new Date(),
  withinDays: number = 30
): SeasonalRule[] {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateNum = month * 100 + day;

  const futureDate = new Date(date);
  futureDate.setDate(futureDate.getDate() + withinDays);
  const futureMonth = futureDate.getMonth() + 1;
  const futureDay = futureDate.getDate();
  const futureDateNum = futureMonth * 100 + futureDay;

  return SEASONAL_RULES.filter((rule) => {
    const start = rule.startMonth * 100 + rule.startDay;
    return start > dateNum && start <= futureDateNum;
  });
}

export function buildSeasonalContext(date: Date = new Date()): string {
  const active = getActiveSeasons(date);
  const upcoming = getUpcomingSeasons(date);

  let context = `Today is ${date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.\n`;
  context += `Location: Saratoga Springs, NY (USDA Zone 4b/5a).\n\n`;

  if (active.length > 0) {
    context += "ACTIVE SEASONAL WINDOWS:\n";
    for (const s of active) {
      context += `- ${s.name} (${s.startMonth}/${s.startDay} – ${s.endMonth}/${s.endDay}): ${s.taskSuggestions.join(", ")}\n`;
    }
    context += "\n";
  }

  if (upcoming.length > 0) {
    context += "UPCOMING (next 30 days):\n";
    for (const s of upcoming) {
      context += `- ${s.name} starts ${s.startMonth}/${s.startDay}: ${s.taskSuggestions.join(", ")}\n`;
    }
  }

  return context;
}
