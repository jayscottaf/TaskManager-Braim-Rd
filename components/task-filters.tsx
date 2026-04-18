"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { STATUSES, PRIORITIES, AREAS } from "@/lib/types";

const TIME_RANGES = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "All", value: "0" },
] as const;

export const DEFAULT_RANGE = "30";

export function TaskFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeStatus = searchParams.get("status") || "";
  const activePriority = searchParams.get("priority") || "";
  const activeArea = searchParams.get("area") || "";
  const activeRange = searchParams.get("range") ?? DEFAULT_RANGE;

  const filterCount = [activeStatus, activePriority, activeArea].filter(Boolean).length;

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("priority");
    params.delete("area");
    router.push(`/?${params.toString()}`);
    setOpen(false);
  }

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="px-5 relative" ref={panelRef}>
      {/* Single row: time range + filter button */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 flex-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setFilter("range", r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeRange === r.value
                  ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-sm"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            open || filterCount > 0
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {filterCount > 0 && (
            <span className="bg-white text-blue-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Collapsible filter panel */}
      {open && (
        <div className="absolute left-5 right-5 top-full mt-2 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-4 z-50 animate-fade-in">
          {/* Status */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1.5">Status</p>
            <div className="flex gap-1.5 flex-wrap">
              <Chip label="All" active={!activeStatus} onClick={() => setFilter("status", "")} />
              {STATUSES.map((s) => (
                <Chip key={s} label={s} active={activeStatus === s} onClick={() => setFilter("status", activeStatus === s ? "" : s)} />
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1.5">Priority</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITIES.map((p) => (
                <Chip key={p} label={p} active={activePriority === p} onClick={() => setFilter("priority", activePriority === p ? "" : p)} />
              ))}
            </div>
          </div>

          {/* Area — select dropdown */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium mb-1.5">Area</p>
            <select
              value={activeArea}
              onChange={(e) => setFilter("area", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
            >
              <option value="">All Areas</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Clear all */}
          {filterCount > 0 && (
            <button onClick={clearAll} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium">
              <X className="w-3 h-3" />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
        active
          ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-sm"
          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
      }`}
    >
      {label}
    </button>
  );
}
