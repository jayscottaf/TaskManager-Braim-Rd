"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { TaskImage } from "@/components/task-image";

let openFn: ((photos: string[], index: number) => void) | null = null;

export function openLightbox(photos: string[], startIndex = 0) {
  openFn?.(photos, startIndex);
}

export function LightboxProvider() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openFn = (p: string[], i: number) => {
      if (p.length === 0) return;
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close, prev, next]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [open]);

  if (!open || photos.length === 0) return null;

  const clampedIndex = Math.min(index, photos.length - 1);
  const multi = photos.length > 1;

  return createPortal(
    <div
      ref={dialogRef}
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
      aria-modal="true"
    >
      {/* Counter */}
      {multi && (
        <span aria-live="polite" className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium">
          {clampedIndex + 1} / {photos.length}
        </span>
      )}

      {/* Close */}
      <button
        type="button"
        ref={closeRef}
        onClick={close}
        className="absolute z-10 top-[calc(1rem+env(safe-area-inset-top))] right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev / Next */}
      {multi && clampedIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute z-10 left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {multi && clampedIndex < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute z-10 right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Next photo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div className="relative h-[85dvh] w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <TaskImage src={photos[clampedIndex]} alt={`Photo ${clampedIndex + 1} of ${photos.length}`} fill sizes="92vw" className="object-contain select-none" loading="eager" />
      </div>
    </div>,
    document.body
  );
}
