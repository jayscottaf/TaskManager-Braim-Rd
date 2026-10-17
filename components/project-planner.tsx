"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import type { WishListPlan } from "@/lib/ai";
import { openLightbox } from "@/components/lightbox";
import { uploadImage } from "@/lib/image-client";
import { TaskImage } from "@/components/task-image";

interface ProjectPlannerProps {
  onPlanned: (plan: WishListPlan, photoUrls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function ProjectPlanner({ onPlanned, onBusyChange }: ProjectPlannerProps) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const previewsRef = useRef<string[]>([]);
  const uploadsRef = useRef(new Map<File, string>());
  const busyRef = useRef(false);
  useEffect(() => () => { previewsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles || busyRef.current) return;
    const added = Array.from(newFiles).filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, 8 - files.length));
    if (added.length < newFiles.length) setError("Choose up to eight photos per project.");
    setFiles((prev) => [...prev, ...added]);
    const nextPreviews = [...previewsRef.current, ...added.map((file) => URL.createObjectURL(file))];
    previewsRef.current = nextPreviews;
    setPreviews(nextPreviews);
  }

  function removePhoto(index: number) {
    if (busyRef.current) return;
    URL.revokeObjectURL(previewsRef.current[index]);
    previewsRef.current = previewsRef.current.filter((_, i) => i !== index);
    uploadsRef.current.delete(files[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePlan() {
    if (!description.trim() || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    onBusyChange?.(true);
    setError(null);

    try {
      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const headers: Record<string, string> = secret ? { "x-app-secret": secret } : {};

      // Successful uploads survive planning failures and are reused on retry.
      const uploads = await Promise.allSettled(files.map(async (file) => {
        const existing = uploadsRef.current.get(file);
        if (existing) return existing;
        const uploaded = await uploadImage(file);
        uploadsRef.current.set(file, uploaded.url);
        return uploaded.url;
      }));
      // Wait for every in-flight attachment before allowing the parent to save.
      const failed = uploads.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      const photoUrls = uploads.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const planRes = await fetch("/api/ai/plan-project", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ description, imageUrl: photoUrls[0] }),
      });
      if (!planRes.ok) {
        const data = await planRes.json().catch(() => null);
        throw new Error(data?.error || "Planning failed. Please try again.");
      }
      const plan: WishListPlan = await planRes.json();

      onPlanned(plan, photoUrls);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to plan project. Try again.");
    } finally {
      busyRef.current = false;
      setLoading(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={description}
        disabled={loading}
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
              <TaskImage width={80} height={80} sizes="80px" src={src} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => openLightbox(previews, i)} />
              <button
                type="button"
                disabled={loading}
                aria-label={`Remove photo ${i + 1}`}
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
          disabled={loading}
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
          disabled={loading}
          onClick={() => galleryRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm"
        >
          <ImagePlus className="w-4 h-4" />
          Gallery
        </button>

        <button
          type="button"
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

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
