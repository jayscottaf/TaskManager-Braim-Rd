import type { WishListItem } from "@/lib/wishlist";
import { getActiveCost } from "@/lib/wishlist-values";

export function CostSummary({ items, selectedIds }: { items: WishListItem[]; selectedIds: Set<string> }) {
  const active = items.filter((item) => item._status !== "Archived" && !item.promotedTaskId);
  const selected = active.filter((item) => selectedIds.has(item.id));
  const compared = selected.length > 0 ? selected : active;
  const estimate = compared.reduce((sum, item) => sum + (getActiveCost(item) ?? 0), 0);
  // Recovery is value added / cost, not net profit or a simple average of project percentages.
  const comparable = compared.filter((item) => (getActiveCost(item) ?? 0) > 0 && item.valueAdd != null);
  const comparableCost = comparable.reduce((sum, item) => sum + getActiveCost(item)!, 0);
  const valueAdded = comparable.reduce((sum, item) => sum + (item.valueAdd ?? 0), 0);
  return <div className="mt-4 grid grid-cols-2 gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
    <div><p className="text-xs text-neutral-600 dark:text-neutral-400">{selected.length ? "Selected estimates" : "All idea estimates"}</p><p className="mt-1 text-xl font-semibold">${estimate.toLocaleString()}</p><p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{compared.length} optional idea{compared.length === 1 ? "" : "s"}</p></div>
    <div><p className="text-xs text-neutral-600 dark:text-neutral-400">Estimated cost recovery</p><p className="mt-1 text-xl font-semibold">{comparableCost > 0 ? `${Math.round(valueAdded / comparableCost * 100)}%` : "—"}</p><p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">Resale value added ÷ cost, where both are estimated. Not profit.</p></div>
  </div>;
}
