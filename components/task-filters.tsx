"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Search, X } from "lucide-react";
import { STATUSES, PRIORITIES, AREAS } from "@/lib/types";

export const DEFAULT_RANGE = "0";

export function TaskFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSearch = searchParams.get("q") || "";
  const activeTag = searchParams.get("tag") || "";
  const activeStatus = searchParams.get("status") || "";
  const activePriority = searchParams.get("priority") || "";
  const activeArea = searchParams.get("area") || "";
  const activeWorkMode = searchParams.get("workMode") || "";
  const activeRange = searchParams.get("range") || DEFAULT_RANGE;
  const [query, setQuery] = useState(activeSearch);
  const [tag, setTag] = useState(activeTag);
  const [open, setOpen] = useState(false);
  const queryRef = useRef(query);
  const tagRef = useRef(tag);
  const dirtySearch = useRef(false);
  const dirtyTag = useRef(false);
  const paramsRef = useRef(searchParams.toString());
  const serializedParams = searchParams.toString();
  useEffect(() => {
    paramsRef.current = serializedParams;
  }, [serializedParams]);

  useEffect(() => {
    if (activeSearch === queryRef.current) dirtySearch.current = false;
    // Synchronize external Back/Forward navigation without overwriting pending typing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dirtySearch.current) setQuery(activeSearch);
  }, [activeSearch]);
  useEffect(() => {
    if (activeTag === tagRef.current) dirtyTag.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize external URL navigation
    if (!dirtyTag.current) setTag(activeTag);
  }, [activeTag]);
  useEffect(() => {
    if (query === activeSearch && tag === activeTag) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(paramsRef.current);
      params.set("list", "all");
      if (query.trim()) params.set("q", query);
      else params.delete("q");
      if (tag.trim()) params.set("tag", tag);
      else params.delete("tag");
      router.replace(`/?${params.toString()}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, tag, activeSearch, activeTag, router]);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(paramsRef.current);
    params.set("list", "all");
    if (query.trim()) params.set("q", query);
    else params.delete("q");
    if (tag.trim()) params.set("tag", tag);
    else params.delete("tag");
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }
  function clearAll() {
    dirtySearch.current = false;
    dirtyTag.current = false;
    queryRef.current = "";
    tagRef.current = "";
    setQuery("");
    setTag("");
    const params = new URLSearchParams({ list: "all" });
    if (searchParams.get("view")) params.set("view", searchParams.get("view")!);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }
  const count = [
    activeStatus,
    activePriority,
    activeArea,
    activeTag,
    activeWorkMode,
    activeRange !== "0" ? activeRange : "",
  ].filter(Boolean).length;
  const selectClasses =
    "w-full min-h-11 rounded-xl border border-neutral-200 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

  return (
    <section
      aria-label="Search and filter tasks"
      className="relative rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="search"
            aria-label="Search all tasks"
            value={query}
            onChange={(event) => {
              dirtySearch.current = true;
              queryRef.current = event.target.value;
              setQuery(event.target.value);
            }}
            placeholder="Search all tasks"
            className={`${selectClasses} pl-9 pr-10`}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                dirtySearch.current = true;
                queryRef.current = "";
                setQuery("");
              }}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-neutral-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="task-filter-options"
          aria-label={`Filters${count ? `, ${count} active` : ""}`}
          onClick={() => setOpen(!open)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-neutral-100 px-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {count > 0 && <span>{count}</span>}
        </button>
      </div>
      {query && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Searching across all dates.
        </p>
      )}
      {count > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            {[
              activeStatus,
              activePriority ? `${activePriority} priority` : "",
              activeArea,
              activeTag ? `Tag: ${activeTag}` : "",
              activeWorkMode,
              activeRange !== "0" && !query
                ? `Through next ${activeRange} days`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="min-h-11 px-2 font-medium text-blue-600 dark:text-blue-400"
          >
            Clear filters
          </button>
        </div>
      )}
      {open && (
        <div
          id="task-filter-options"
          className="mt-4 grid gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-2"
        >
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Status
            <select
              className={`${selectClasses} mt-2`}
              value={activeStatus}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              <option value="">Open tasks</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Priority
            <select
              className={`${selectClasses} mt-2`}
              value={activePriority}
              onChange={(event) => setFilter("priority", event.target.value)}
            >
              <option value="">Any priority</option>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Area
            <select
              className={`${selectClasses} mt-2`}
              value={activeArea}
              onChange={(event) => setFilter("area", event.target.value)}
            >
              <option value="">Any area</option>
              {AREAS.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Tag
            <input
              className={`${selectClasses} mt-2`}
              value={tag}
              onChange={(event) => {
                dirtyTag.current = true;
                tagRef.current = event.target.value;
                setTag(event.target.value);
              }}
              placeholder="Any tag"
            />
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Work mode
            <select
              className={`${selectClasses} mt-2`}
              value={activeWorkMode}
              onChange={(event) => setFilter("workMode", event.target.value)}
            >
              <option value="">Any work mode</option>
              <option>DIY</option>
              <option>Contractor</option>
            </select>
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Planned through
            <select
              className={`${selectClasses} mt-2`}
              value={activeRange}
              disabled={Boolean(query)}
              onChange={(event) => setFilter("range", event.target.value)}
            >
              <option value="0">All dates</option>
              <option value="7">Next 7 days</option>
              <option value="30">Next 30 days</option>
              <option value="90">Next 90 days</option>
            </select>
          </label>
          <label className="text-sm text-neutral-600 dark:text-neutral-300">
            Group tasks
            <select
              className={`${selectClasses} mt-2`}
              value={searchParams.get("view") || ""}
              onChange={(event) => setFilter("view", event.target.value)}
            >
              <option value="">By plan date</option>
              <option value="area">By area</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 self-end rounded-xl bg-neutral-100 px-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            Done
          </button>
        </div>
      )}
    </section>
  );
}
