interface RoiBadgeProps { rating: string | null; roi?: number | null; size?: "sm" | "md" }

export function RoiBadge({ roi, size = "sm" }: RoiBadgeProps) {
  if (roi == null || !Number.isFinite(roi)) return null;
  return <span title="Estimated resale value added divided by project cost. This is cost recovery, not profit." className={`inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 ${size === "md" ? "text-xs" : "text-[11px]"}`}>
    ~{Math.round(roi)}% cost recovery
  </span>;
}
