"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, X } from "lucide-react";
import type { PhotoClassification } from "@/lib/ai";

interface CameraCaptureProps {
  onClassified: (result: PhotoClassification) => void;
}

export function CameraCapture({ onClassified }: CameraCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setError(null);

    try {
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
      onClassified(result);
    } catch {
      setError("Failed to classify photo. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPreview(null);
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

      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Captured"
            className="w-full h-48 object-cover rounded-xl border border-gray-200"
          />
          {loading && (
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
              <div className="flex items-center gap-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Analyzing...</span>
              </div>
            </div>
          )}
          {!loading && (
            <button
              onClick={reset}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
        </div>
      ) : (
        <label
          htmlFor="camera-input"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 active:bg-gray-50 transition-colors cursor-pointer"
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
