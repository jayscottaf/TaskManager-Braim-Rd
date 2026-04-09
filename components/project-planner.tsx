"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, Sparkles, X } from "lucide-react";
import type { WishListPlan } from "@/lib/ai";

interface ProjectPlannerProps {
  onPlanned: (plan: WishListPlan, photoUrl?: string) => void;
}

export function ProjectPlanner({ onPlanned }: ProjectPlannerProps) {
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function removePhoto() {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handlePlan() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const headers: Record<string, string> = secret ? { "x-app-secret": secret } : {};

      // AI plan + photo upload in parallel
      const planForm = new FormData();
      planForm.append("description", description);
      if (file) planForm.append("image", file);

      const promises: Promise<Response | null>[] = [
        fetch("/api/ai/plan-project", { method: "POST", headers, body: planForm }),
      ];

      // Upload photo if present
      if (file) {
        const uploadForm = new FormData();
        uploadForm.append("image", file);
        promises.push(
          fetch("/api/upload", { method: "POST", headers, body: uploadForm }).catch(() => null)
        );
      }

      const [planRes, uploadRes] = await Promise.all(promises);

      if (!planRes || !planRes.ok) {
        const errData = planRes ? await planRes.json().catch(() => null) : null;
        throw new Error(errData?.error || `Planning failed (${planRes?.status || "no response"})`);
      }

      const plan: WishListPlan = await planRes.json();
      let photoUrl: string | undefined;

      if (uploadRes?.ok) {
        const data = await uploadRes.json();
        photoUrl = data.url;
      }

      onPlanned(plan, photoUrl);
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

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
          id="planner-photo"
        />

        {preview ? (
          <div className="relative w-20 h-20 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Project" className="w-20 h-20 object-cover rounded-xl" />
            <button
              onClick={removePhoto}
              className="absolute -top-1.5 -right-1.5 bg-black/60 text-white rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="planner-photo"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer text-sm"
          >
            <Camera className="w-4 h-4" />
            Photo
          </label>
        )}

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
