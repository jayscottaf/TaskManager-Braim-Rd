"use client";

import { useState, useRef } from "react";
import { Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import type { WishListPlan } from "@/lib/ai";

const MAX_SIZE = 1024;
const JPEG_QUALITY = 0.7;

/** Resize an image file client-side to stay under Vercel's 4.5MB body limit */
function resizeImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= MAX_SIZE && height <= MAX_SIZE) { resolve(file); return; }
      if (width > height) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      } else {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

async function uploadFile(file: File, secret: string): Promise<string | null> {
  const form = new FormData();
  form.append("image", file);
  const headers: Record<string, string> = secret ? { "x-app-secret": secret } : {};
  try {
    const res = await fetch("/api/upload", { method: "POST", headers, body: form });
    if (res.ok) { const data = await res.json(); return data.url; }
  } catch { /* ignore */ }
  return null;
}

interface ProjectPlannerProps {
  onPlanned: (plan: WishListPlan, photoUrls: string[]) => void;
}

export function ProjectPlanner({ onPlanned }: ProjectPlannerProps) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const added = Array.from(newFiles);
    setFiles((prev) => [...prev, ...added]);
    setPreviews((prev) => [...prev, ...added.map((f) => URL.createObjectURL(f))]);
  }

  function removePhoto(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePlan() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const headers: Record<string, string> = secret ? { "x-app-secret": secret } : {};

      // Send first photo (resized) to AI for analysis
      const resizedFile = files[0] ? await resizeImage(files[0]) : null;
      const planForm = new FormData();
      planForm.append("description", description);
      if (resizedFile) planForm.append("image", resizedFile);

      // AI plan + upload all photos in parallel
      const planPromise = fetch("/api/ai/plan-project", { method: "POST", headers, body: planForm });
      const uploadPromises = files.map((f) => uploadFile(f, secret));

      const [planRes, ...uploadedUrls] = await Promise.all([planPromise, ...uploadPromises]);

      if (!planRes || !planRes.ok) {
        const errData = await planRes.json().catch(() => null);
        throw new Error(errData?.error || `Planning failed (${planRes?.status || "no response"})`);
      }

      const plan: WishListPlan = await planRes.json();
      const photoUrls = uploadedUrls.filter((u): u is string => u != null);

      onPlanned(plan, photoUrls);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to plan project. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your dream project... e.g., 'I want to add a Belgium block border around my driveway' or 'Build a new deck off the back of the house'"
        rows={3}
        className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow resize-y"
      />

      {/* Photo previews */}
      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {previews.map((src, i) => (
            <div key={i} className="relative w-20 h-20 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute -top-1.5 -right-1.5 bg-black/60 text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {/* Camera (take photo) */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm"
        >
          <Camera className="w-4 h-4" />
          Camera
        </button>

        {/* Gallery / file picker (multiple) */}
        <input ref={galleryRef} type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm"
        >
          <ImagePlus className="w-4 h-4" />
          Gallery
        </button>

        <button
          onClick={handlePlan}
          disabled={loading || !description.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Planning...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Plan It
            </>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
