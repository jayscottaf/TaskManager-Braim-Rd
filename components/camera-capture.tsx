"use client";

import { useState, useRef, useEffect, useId } from "react";
import { Camera, Loader2, X, Plus } from "lucide-react";
import type { PhotoClassification } from "@/lib/ai";
import { analyzeUploadedImage, uploadImage } from "@/lib/image-client";
import { openLightbox } from "@/components/lightbox";
import { TaskImage } from "@/components/task-image";

interface CameraCaptureProps {
  onClassified: (result: PhotoClassification | null, photoUrls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function CameraCapture({ onClassified, onBusyChange }: CameraCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const photosRef = useRef<string[]>([]);
  const classifiedRef = useRef(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [contextText, setContextText] = useState("");
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  useEffect(() => () => { if (pendingRef.current) URL.revokeObjectURL(pendingRef.current); }, []);

  function busy(value: boolean) {
    busyRef.current = value;
    setLoading(value);
    onBusyChange?.(value);
  }

  function publish(next: string[], result: PhotoClassification | null = null) {
    photosRef.current = next;
    setPhotos(next);
    onClassified(result, next);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || busyRef.current) return;
    busy(true);
    setError(null);
    const preview = URL.createObjectURL(file);
    pendingRef.current = preview;
    setPendingPreview(preview);
    try {
      const result = await uploadImage(file, { analysis: classifiedRef.current ? undefined : "task", context: contextText });
      const classification = result.classification as PhotoClassification | undefined;
      if (classification) classifiedRef.current = true;
      publish([...photosRef.current, result.url], classification || null);
      setError(result.analysisError || null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Photo did not upload. Please try again.");
    } finally {
      URL.revokeObjectURL(preview);
      pendingRef.current = null;
      setPendingPreview(null);
      busy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function retryAnalysis() {
    if (!photosRef.current.length || busyRef.current) return;
    busy(true);
    setError(null);
    try {
      const result = await analyzeUploadedImage(photosRef.current[0], "task", contextText) as PhotoClassification;
      classifiedRef.current = true;
      publish(photosRef.current, result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Suggestions failed. The photo is still attached.");
    } finally { busy(false); }
  }

  function removePhoto(index: number) {
    const next = photosRef.current.filter((_, i) => i !== index);
    if (!next.length) classifiedRef.current = false;
    publish(next);
    setError(null);
  }

  function reset() {
    classifiedRef.current = false;
    publish([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={loading} className="hidden" id={inputId} />
      {!classifiedRef.current && <textarea value={contextText} onChange={(e) => setContextText(e.target.value)} placeholder="Optional photo context" aria-label="Photo context" rows={2} className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none" />}
      {(photos.length > 0 || pendingPreview) && <div className="flex gap-2 overflow-x-auto">
        {photos.map((url, index) => <div key={url} className="relative flex-shrink-0 w-36 h-28">
          <button type="button" onClick={() => openLightbox(photos, index)} className="relative block w-full h-full rounded-xl overflow-hidden" aria-label={`Open photo ${index + 1}`}><TaskImage src={url} alt={`Task photo ${index + 1}`} fill sizes="144px" className="object-cover" /></button>
          <button type="button" onClick={() => removePhoto(index)} disabled={loading} aria-label={`Remove photo ${index + 1}`} className="absolute top-1 right-1 bg-black/60 text-white rounded-lg p-2"><X className="w-4 h-4" /></button>
        </div>)}
        {pendingPreview && <div className="relative flex-shrink-0 w-36 h-28"><TaskImage src={pendingPreview} alt="Photo uploading" fill sizes="144px" className="object-cover rounded-xl opacity-60" /></div>}
      </div>}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-300 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : photos.length ? <Plus className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        {loading ? "Attaching photo…" : photos.length ? "Add another photo" : "Add a photo for suggestions"}
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {error && photos.length > 0 && !classifiedRef.current && <button type="button" onClick={retryAnalysis} disabled={loading} className="text-sm text-blue-600 text-left">Retry suggestions</button>}
      {photos.length > 0 && <button type="button" onClick={reset} disabled={loading} className="text-sm text-neutral-500 dark:text-neutral-300 self-start py-2">Clear photos</button>}
    </div>
  );
}
