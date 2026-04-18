"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, X, Plus } from "lucide-react";
import type { PhotoClassification } from "@/lib/ai";

interface CameraCaptureProps {
  onClassified: (result: PhotoClassification, photoUrls: string[]) => void;
}

export function CameraCapture({ onClassified }: CameraCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [classified, setClassified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File): Promise<string | null> {
    const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: secret ? { "x-app-secret": secret } : {},
      body: formData,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url;
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPreviews((prev) => [...prev, previewUrl]);
    setLoading(true);
    setError(null);

    try {
      const blobUrl = await uploadPhoto(file);
      if (!blobUrl) throw new Error("Upload failed");

      const newPhotos = [...photos, blobUrl];
      setPhotos(newPhotos);

      if (!classified) {
        const formData = new FormData();
        formData.append("image", file);
        const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
        const res = await fetch("/api/ai/classify", {
          method: "POST",
          headers: secret ? { "x-app-secret": secret } : {},
          body: formData,
        });
        if (!res.ok) throw new Error("Classification failed");
        const result: PhotoClassification = await res.json();
        setClassified(true);
        onClassified(result, newPhotos);
      } else {
        onClassified(null as unknown as PhotoClassification, newPhotos);
      }
    } catch {
      setError("Failed to process photo. Try again.");
      setPreviews((prev) => prev.filter((p) => p !== previewUrl));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (photos.length <= 1) setClassified(false);
  }

  function reset() {
    setPreviews([]);
    setPhotos([]);
    setClassified(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        id="camera-input"
      />

      {previews.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory">
            {previews.map((url, i) => (
              <div key={i} className="relative flex-shrink-0 snap-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="w-36 h-28 object-cover rounded-xl shadow-sm" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-lg p-1 hover:bg-black/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label
              htmlFor="camera-input"
              className="flex-shrink-0 w-36 h-28 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Add more</span>
            </label>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {classified ? "Uploading..." : "Analyzing..."}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={reset}
            className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 self-start"
          >
            Clear all photos
          </button>
        </div>
      ) : (
        <label
          htmlFor="camera-input"
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400 active:bg-blue-50 dark:active:bg-blue-950/40 transition-all cursor-pointer"
        >
          <Camera className="w-5 h-5" />
          <span className="text-sm font-medium">
            Snap a photo — AI will classify the issue
          </span>
        </label>
      )}
    </div>
  );
}
