import type { WishListItem } from "@/lib/wishlist";

interface CostSummaryProps {
  items: WishListItem[];
  selectedIds: Set<string>;
}

export function CostSummary({ items, selectedIds }: CostSummaryProps) {
  const activeItems = items.filter((i) => i._status !== "Archived");
  const selectedItems = activeItems.filter((i) => selectedIds.has(i.id));

  const totalCost = activeItems.reduce((sum, i) => sum + (i.estimatedCost || 0), 0);
  const selectedCost = selectedItems.reduce((sum, i) => sum + (i.estimatedCost || 0), 0);

  const roisForAvg = (selectedItems.length > 0 ? selectedItems : activeItems)
    .filter((i) => i.roi != null)
    .map((i) => i.roi!);
  const avgRoi = roisForAvg.length > 0
    ? Math.round(roisForAvg.reduce((a, b) => a + b, 0) / roisForAvg.length)
    : null;

  return (
    <div className="mx-5 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm p-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">All Items</p>
          <p className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
            ${totalCost.toLocaleString()}
          </p>
          <p className="text-[10px] text-neutral-400">{activeItems.length} project{activeItems.length !== 1 ? "s" : ""}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Selected</p>
          <p className="text-lg font-bold text-blue-600">
            {selectedItems.length > 0 ? `$${selectedCost.toLocaleString()}` : "—"}
          </p>
          <p className="text-[10px] text-neutral-400">
            {selectedItems.length > 0 ? `${selectedItems.length} project${selectedItems.length !== 1 ? "s" : ""}` : "none"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-medium">Avg ROI</p>
          <p className={`text-lg font-bold ${avgRoi != null && avgRoi >= 100 ? "text-emerald-600" : avgRoi != null && avgRoi >= 50 ? "text-blue-600" : "text-neutral-400"}`}>
            {avgRoi != null ? `${avgRoi}%` : "—"}
          </p>
          <p className="text-[10px] text-neutral-400">
            {selectedItems.length > 0 ? "of selected" : "of all"}
          </p>
        </div>
      </div>
    </div>
  );
}
