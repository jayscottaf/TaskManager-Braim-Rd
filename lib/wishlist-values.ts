import type { WishListItem } from "./wishlist";

export function getActiveCost(item: WishListItem): number | null {
  return item.costMode === "Hired Out" ? item.hiredCost : item.diyCost;
}
export function getActiveRoi(item: WishListItem): number | null {
  return item.costMode === "Hired Out" ? item.hiredRoi : item.diyRoi;
}
export function getActiveRoiRating(item: WishListItem): string | null {
  return item.costMode === "Hired Out" ? item.hiredRoiRating : item.diyRoiRating;
}
