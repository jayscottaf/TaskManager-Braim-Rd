"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getActiveSeasons, getUpcomingSeasons } from "@/lib/seasonal";
import { Sun, Snowflake, Leaf, Flower, ChevronDown, ChevronUp, Plus, Check, Calendar } from "lucide-react";
import type { SeasonalRule } from "@/lib/seasonal";

function getSeasonIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("winter") || lower.includes("snow")) return Snowflake;
  if (lower.includes("fall") || lower.includes("pool closing")) return Leaf;
  if (lower.includes("spring") || lower.includes("pool opening")) return Flower;
  return Sun;
}

/** Build the due date from the season's end window */
function seasonEndDate(season: SeasonalRule): string {
  const year = new Date().getFullYear();
  const m = String(season.endMonth).padStart(2, "0");
  const d = String(season.endDay).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Build prefill URL for the Add page */
function buildAddUrl(taskName: string, season: SeasonalRule): string {
  const params = new URLSearchParams();
  params.set("task", taskName);
  params.set("area", season.area);
  params.set("types", season.types.join(","));
  params.set("priority", "Medium");
  params.set("frequency", "Annually");
  params.set("dueDate", seasonEndDate(season));
  return `/add?${params.toString()}`;
}

/** Normalize a task name for fuzzy matching */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function SeasonCard({
  season,
  variant,
  existingTasks,
}: {
  season: SeasonalRule;
  variant: "active" | "upcoming";
  existingTasks: string[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const Icon = getSeasonIcon(season.name);

  const colors = variant === "active"
    ? {
        bg: "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800",
        text: "text-neutral-900 dark:text-neutral-50",
        sub: "text-neutral-500 dark:text-neutral-400",
        badge: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
        taskBg: "bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800",
        addBtn: "bg-blue-600 hover:bg-blue-700 text-white",
        doneBtn: "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
      }
    : {
        bg: "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800",
        text: "text-neutral-900 dark:text-neutral-50",
        sub: "text-neutral-500 dark:text-neutral-400",
        badge: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
        taskBg: "bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800",
        addBtn: "bg-blue-600 hover:bg-blue-700 text-white",
        doneBtn: "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
      };

  // Check which suggestions already exist as tasks
  const normalizedExisting = existingTasks.map(normalize);
  function alreadyExists(suggestion: string): boolean {
    const norm = normalize(suggestion);
    return normalizedExisting.some(
      (existing) => existing.includes(norm) || norm.includes(existing)
    );
  }

  // Count how many suggestions are already added
  const addedCount = season.taskSuggestions.filter(alreadyExists).length;
  const totalCount = season.taskSuggestions.length;

  return (
    <div className={`rounded-2xl shadow-sm ${colors.bg} overflow-hidden transition-all`}>
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
              ? addedCount > 0
                ? `${addedCount}/${totalCount} added`
                : `${totalCount} suggested tasks`
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
          {season.taskSuggestions.map((task) => {
            const exists = alreadyExists(task);
            return (
              <div
                key={task}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${colors.taskBg} transition-colors`}
              >
                <span className={`text-xs ${colors.text} flex-1 min-w-0 ${exists ? "line-through opacity-60" : ""}`}>{task}</span>
                {exists ? (
                  <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${colors.doneBtn} flex-shrink-0`}>
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <button
                    onClick={() => router.push(buildAddUrl(task, season))}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg ${colors.addBtn} flex-shrink-0 active:scale-95 transition-all`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SeasonalBanner() {
  const active = getActiveSeasons();
  const upcoming = getUpcomingSeasons(new Date(), 21);
  const [existingTasks, setExistingTasks] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Fetch existing task names for duplicate detection
  useEffect(() => {
    const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
    fetch("/api/tasks", {
      headers: secret ? { "x-app-secret": secret } : {},
    })
      .then((r) => r.json())
      .then((tasks: { task: string }[]) => {
        setExistingTasks(tasks.map((t) => t.task));
      })
      .catch(() => {});
  }, []);

  const all = [...active, ...upcoming];
  if (all.length === 0) return null;

  if (!showAll) {
    return (
      <div className="px-5">
        <button
          onClick={() => setShowAll(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
            <Calendar className="w-4 h-4 text-neutral-400" />
            {active.length} active season{active.length !== 1 ? "s" : ""}
            {upcoming.length > 0 ? `, ${upcoming.length} upcoming` : ""}
          </span>
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-5">
      <button
        onClick={() => setShowAll(false)}
        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 self-end px-1"
      >
        Collapse <ChevronUp className="w-3 h-3" />
      </button>
      {active.map((season) => (
        <SeasonCard key={season.name} season={season} variant="active" existingTasks={existingTasks} />
      ))}
      {upcoming.map((season) => (
        <SeasonCard key={season.name} season={season} variant="upcoming" existingTasks={existingTasks} />
      ))}
    </div>
  );
}
