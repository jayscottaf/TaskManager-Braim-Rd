"use client";

import { openLightbox } from "@/components/lightbox";
import { TaskImage } from "@/components/task-image";

export function PhotoGallery({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;

  return (
    <div className="flex gap-1 overflow-x-auto snap-x snap-mandatory pb-3 px-1">
      {photos.map((url, i) => (
        <button
          type="button"
          key={`${url}-${i}`}
          aria-label={`Open completed work photo ${i + 1}`}
          className="relative w-48 h-36 flex-shrink-0 snap-center rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
          onClick={() => openLightbox(photos, i)}
        >
          <TaskImage src={url} alt={`Completed work ${i + 1}`} fill sizes="192px" className="object-cover" />
        </button>
      ))}
    </div>
  );
}
