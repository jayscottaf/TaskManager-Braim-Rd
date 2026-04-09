"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { STATUSES, PRIORITIES, AREAS } from "@/lib/types";

export function TaskFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeStatus = searchParams.get("status") || "";
  const activePriority = searchParams.get("priority") || "";
  const activeArea = searchParams.get("area") || "";

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 px-5">
      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <FilterChip
          label="All"
          active={!activeStatus}
          onClick={() => setFilter("status", "")}
        />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={s}
            active={activeStatus === s}
            onClick={() => setFilter("status", activeStatus === s ? "" : s)}
          />
        ))}
      </div>
      {/* Priority + Area row */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {PRIORITIES.map((p) => (
          <FilterChip
            key={p}
            label={p}
            active={activePriority === p}
            onClick={() => setFilter("priority", activePriority === p ? "" : p)}
          />
        ))}
        <span className="w-px bg-neutral-200 mx-1 self-stretch" />
        {AREAS.map((a) => (
          <FilterChip
            key={a}
            label={a}
            active={activeArea === a}
            onClick={() => setFilter("area", activeArea === a ? "" : a)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
        active
          ? "bg-neutral-950 text-white shadow-sm"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 active:bg-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}
