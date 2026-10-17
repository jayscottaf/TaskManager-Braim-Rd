"use client";

import { useState, useRef, useEffect, useId } from "react";
import { Camera, Loader2, X, ScanLine } from "lucide-react";
import type { PaintLabelScan } from "@/lib/ai";
import { openLightbox } from "@/components/lightbox";
import { TaskImage } from "@/components/task-image";
import { analyzeUploadedImage, uploadImage } from "@/lib/image-client";

interface PaintScannerProps {
  onScanned: (data: Record<string, string>) => void;
  onBusyChange?: (busy: boolean) => void;
}

// Map AI response fields to paint tracker schema field names
function mapScanToFormData(scan: PaintLabelScan, photoUrl?: string): Record<string, string> {
  const data: Record<string, string> = {};
  if (scan.brand) data["Brand"] = scan.brand;
  if (scan.colorName) data["Color Name"] = scan.colorName;
  if (scan.colorCode) data["Color Code"] = scan.colorCode;
  if (scan.finish) data["Finish"] = scan.finish;
  if (scan.interiorExterior) data["Interior/Exterior"] = scan.interiorExterior;
  if (scan.size) data["Size"] = scan.size;
  if (scan.base) data["Base"] = scan.base;
  if (scan.colorantFormula) data["Colorant Formula"] = scan.colorantFormula;
  if (scan.roomsUsed) data["Rooms Used"] = scan.roomsUsed;
  if (scan.store) data["Store"] = scan.store;
  if (scan.purchaseDate) data["Purchase Date"] = scan.purchaseDate;
  if (photoUrl) data["Photo"] = photoUrl;
  return data;
}

export function PaintScanner({ onScanned, onBusyChange }: PaintScannerProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewRef = useRef<string | null>(null);
  const savedUrlRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const inputId = useId();
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  function busy(value: boolean) {
    busyRef.current = value;
    setLoading(value);
    onBusyChange?.(value);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || busyRef.current) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(file);
    setPreview(previewRef.current);
    savedUrlRef.current = null;
    busy(true);
    setError(null);
    setScanned(false);
    try {
      const result = await uploadImage(file, { analysis: "paint" });
      savedUrlRef.current = result.url;
      setPreview(result.url);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      if (result.classification) {
        onScanned(mapScanToFormData(result.classification as PaintLabelScan, result.url));
        setScanned(true);
      } else {
        // Keep a successful attachment even when AI fails.
        onScanned({ Photo: result.url });
      }
      setError(result.analysisError || null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Photo did not upload. Please try again.");
    } finally {
      busy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function retry() {
    if (!savedUrlRef.current || busyRef.current) return;
    busy(true);
    setError(null);
    try {
      const result = await analyzeUploadedImage(savedUrlRef.current, "paint") as PaintLabelScan;
      onScanned(mapScanToFormData(result, savedUrlRef.current));
      setScanned(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Label could not be read. The photo remains attached.");
    } finally { busy(false); }
  }

  function reset() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    if (savedUrlRef.current) onScanned({ Photo: "" });
    savedUrlRef.current = null;
    setPreview(null);
    setError(null);
    setScanned(false);
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
        id={inputId}
        disabled={loading}
      />

      {preview ? (
        <div className="relative">
          <TaskImage
            src={preview}
            alt="Paint label"
            width={640}
            height={480}
            sizes="(max-width: 640px) 100vw, 640px"
            className="w-full h-48 object-cover rounded-2xl shadow-sm cursor-pointer"
            onClick={() => { if (!loading) openLightbox([preview]); }}
          />
          {loading && (
            <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <div className="flex items-center gap-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Reading label...</span>
              </div>
            </div>
          )}
          {scanned && !loading && (
            <div className="absolute inset-0 bg-green-900/30 rounded-2xl flex items-center justify-center pointer-events-none">
              <span className="text-sm font-semibold text-white bg-green-600 px-3 py-1 rounded-lg">
                Label scanned — fields pre-filled below
              </span>
            </div>
          )}
          {!loading && (
            <button
              type="button"
              aria-label="Clear paint label photo"
              onClick={reset}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-lg p-1.5 hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {error && savedUrlRef.current && !scanned && <button type="button" onClick={retry} disabled={loading} className="text-sm text-blue-600 mt-2 py-2">Retry reading label</button>}
          {error && (
            <p role="alert" className="text-sm text-red-600 mt-1">{error}</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <label
            htmlFor={inputId}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:border-amber-400 hover:bg-amber-50/30 active:bg-amber-50 transition-all cursor-pointer"
          >
            <Camera className="w-5 h-5" />
            <ScanLine className="w-4 h-4" />
            <span className="text-sm font-medium">
              Scan paint label to auto-fill
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
