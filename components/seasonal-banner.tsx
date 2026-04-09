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
    <div className="flex flex-col gap-2 px-5">
      {active.map((season) => {
        const Icon = getSeasonIcon(season.name);
        return (
          <div
            key={season.name}
            className="flex items-center gap-3 bg-blue-50/50 border-l-2 border-l-blue-500 rounded-xl px-4 py-3"
          >
            <Icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-blue-900 font-semibold">
                {season.name} season is active
              </span>
              <p className="text-xs text-blue-600/70 truncate">
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
            className="flex items-center gap-3 bg-violet-50/50 border-l-2 border-l-violet-400 rounded-xl px-4 py-3"
          >
            <Icon className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="text-sm text-violet-700 font-medium">
              {season.name} starts {season.startMonth}/{season.startDay}
            </span>
          </div>
        );
      })}
    </div>
  );
}
