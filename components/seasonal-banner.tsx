import { getActiveSeasons, getUpcomingSeasons } from "@/lib/seasonal";
import { Sun, Snowflake, Leaf, Flower } from "lucide-react";

function getSeasonIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("winter") || lower.includes("snow")) return Snowflake;
  if (lower.includes("fall") || lower.includes("pool closing")) return Leaf;
  if (lower.includes("spring") || lower.includes("pool opening")) return Flower;
  return Sun;
}

export function SeasonalBanner() {
  const active = getActiveSeasons();
  const upcoming = getUpcomingSeasons(new Date(), 21);

  if (active.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4">
      {active.map((season) => {
        const Icon = getSeasonIcon(season.name);
        return (
          <div
            key={season.name}
            className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5"
          >
            <Icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-blue-800 font-semibold">
                {season.name} season is active
              </span>
              <p className="text-xs text-blue-600 truncate">
                {season.taskSuggestions[0]}
              </p>
            </div>
          </div>
        );
      })}
      {upcoming.map((season) => {
        const Icon = getSeasonIcon(season.name);
        return (
          <div
            key={season.name}
            className="flex items-center gap-2.5 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5"
          >
            <Icon className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span className="text-sm text-purple-700 font-medium">
              {season.name} starts {season.startMonth}/{season.startDay}
            </span>
          </div>
        );
      })}
    </div>
  );
}
