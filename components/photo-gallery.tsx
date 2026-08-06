"use client";

import { openLightbox } from "@/components/lightbox";

export function PhotoGallery({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;

  return (
    <div className="flex gap-1 overflow-x-auto snap-x snap-mandatory pb-3 px-1">
      {photos.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt={`Completed work ${i + 1}`}
          className="w-48 h-36 flex-shrink-0 snap-center object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => openLightbox(photos, i)}
        />
      ))}
    </div>
  );
}
