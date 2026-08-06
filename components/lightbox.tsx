"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

let openFn: ((photos: string[], index: number) => void) | null = null;

export function openLightbox(photos: string[], startIndex = 0) {
  openFn?.(photos, startIndex);
}

export function LightboxProvider() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    openFn = (p: string[], i: number) => {
      if (p.length === 0) return;
      setPhotos(p);
      setIndex(Math.min(Math.max(i, 0), p.length - 1));
      setOpen(true);
    };
    return () => {
      openFn = null;
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const prev = useCallback(
    () => setIndex((i) => (i > 0 ? i - 1 : i)),
    []
  );
  const next = useCallback(
    () => setIndex((i) => (i < photos.length - 1 ? i + 1 : i)),
    [photos.length]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close, prev, next]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || photos.length === 0) return null;

  const clampedIndex = Math.min(index, photos.length - 1);
  const multi = photos.length > 1;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/95 flex items-center justify-center animate-fade-in"
      onClick={close}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (dx > 50) prev();
        else if (dx < -50) next();
      }}
      role="dialog"
      aria-label="Photo viewer"
    >
      {/* Counter */}
      {multi && (
        <span className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium">
          {clampedIndex + 1} / {photos.length}
        </span>
      )}

      {/* Close */}
      <button
        onClick={close}
        className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev / Next */}
      {multi && clampedIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {multi && clampedIndex < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[clampedIndex]}
        alt={`Photo ${clampedIndex + 1} of ${photos.length}`}
        className="max-h-[85vh] max-w-[92vw] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}
