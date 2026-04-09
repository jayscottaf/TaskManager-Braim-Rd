"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveSeasons, getUpcomingSeasons } from "@/lib/seasonal";
import { Sun, Snowflake, Leaf, Flower, ChevronDown, ChevronUp, Plus, Loader2 } from "lucide-react";
import type { SeasonalRule } from "@/lib/seasonal";

function getSeasonIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("winter") || lower.includes("snow")) return Snowflake;
  if (lower.includes("fall") || lower.includes("pool closing")) return Leaf;
  if (lower.includes("spring") || lower.includes("pool opening")) return Flower;
  return Sun;
}

function SeasonCard({ season, variant }: { season: SeasonalRule; variant: "active" | "upcoming" }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const Icon = getSeasonIcon(season.name);

  const colors = variant === "active"
    ? {
        bg: "bg-blue-600 dark:bg-blue-700",
        text: "text-white",
        sub: "text-blue-100",
        badge: "bg-blue-500/30 text-blue-100",
        taskBg: "bg-blue-500/20 hover:bg-blue-500/30",
        addBtn: "bg-white/20 hover:bg-white/30 text-white",
      }
    : {
        bg: "bg-violet-600 dark:bg-violet-700",
        text: "text-white",
        sub: "text-violet-100",
        badge: "bg-violet-500/30 text-violet-100",
        taskBg: "bg-violet-500/20 hover:bg-violet-500/30",
        addBtn: "bg-white/20 hover:bg-white/30 text-white",
      };

  async function addTask(taskName: string) {
    setAdding(taskName);
    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-app-secret": secret } : {}),
        },
        body: JSON.stringify({
          task: taskName,
          area: season.area,
          type: season.types,
        }),
      });
      router.refresh();
    } catch {
      // ignore
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className={`rounded-2xl ${colors.bg} overflow-hidden transition-all`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Icon className={`w-5 h-5 ${colors.text} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${colors.text}`}>
            {season.name}
          </p>
          <p className={`text-xs ${colors.sub}`}>
            {variant === "active"
              ? `${season.taskSuggestions.length} suggested tasks`
              : `Starts ${season.startMonth}/${season.startDay}`}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-medium`}>
          {variant === "active" ? "Active" : "Soon"}
        </span>
        {expanded
          ? <ChevronUp className={`w-4 h-4 ${colors.sub} flex-shrink-0`} />
          : <ChevronDown className={`w-4 h-4 ${colors.sub} flex-shrink-0`} />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {season.taskSuggestions.map((task) => (
            <div
              key={task}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${colors.taskBg} transition-colors`}
            >
              <span className={`text-xs ${colors.text} flex-1 min-w-0`}>{task}</span>
              <button
                onClick={() => addTask(task)}
                disabled={adding === task}
                className={`flex items-center justify-center w-7 h-7 rounded-lg ${colors.addBtn} flex-shrink-0 active:scale-95 disabled:opacity-50 transition-all`}
              >
                {adding === task
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SeasonalBanner() {
  const active = getActiveSeasons();
  const upcoming = getUpcomingSeasons(new Date(), 21);

  if (active.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-5">
      {active.map((season) => (
        <SeasonCard key={season.name} season={season} variant="active" />
      ))}
      {upcoming.map((season) => (
        <SeasonCard key={season.name} season={season} variant="upcoming" />
      ))}
    </div>
  );
}
