interface RoiBadgeProps {
  rating: string | null;
  roi?: number | null;
  size?: "sm" | "md";
}

const COLORS: Record<string, string> = {
  "High ROI": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  Good: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  Low: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  Lifestyle: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
};

export function RoiBadge({ rating, roi, size = "sm" }: RoiBadgeProps) {
  if (!rating) return null;

  const color = COLORS[rating] || COLORS.Low;
  const textSize = size === "md" ? "text-xs" : "text-[10px]";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${textSize} ${color}`}>
      {roi != null && `${Math.round(roi)}% `}
      {rating}
    </span>
  );
}
