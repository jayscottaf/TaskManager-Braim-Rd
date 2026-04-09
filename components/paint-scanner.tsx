"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, X, ScanLine } from "lucide-react";
import type { PaintLabelScan } from "@/lib/ai";

interface PaintScannerProps {
  onScanned: (data: Record<string, string>) => void;
}

// Map AI response fields to paint tracker schema field names
function mapScanToFormData(scan: PaintLabelScan): Record<string, string> {
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
  return data;
}

export function PaintScanner({ onScanned }: PaintScannerProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setError(null);
    setScanned(false);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const secret = process.env.NEXT_PUBLIC_APP_SECRET || "";
      const res = await fetch("/api/ai/classify-paint", {
        method: "POST",
        headers: secret ? { "x-app-secret": secret } : {},
        body: formData,
      });

      if (!res.ok) throw new Error("Scan failed");

      const result: PaintLabelScan = await res.json();
      const mapped = mapScanToFormData(result);
      onScanned(mapped);
      setScanned(true);
    } catch {
      setError("Failed to read label. Try a clearer photo.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
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
        id="paint-scan-input"
      />

      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Paint label"
            className="w-full h-48 object-cover rounded-2xl shadow-sm"
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
            <div className="absolute inset-0 bg-green-900/30 rounded-2xl flex items-center justify-center">
              <span className="text-sm font-semibold text-white bg-green-600 px-3 py-1 rounded-lg">
                Label scanned — fields pre-filled below
              </span>
            </div>
          )}
          {!loading && (
            <button
              onClick={reset}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-lg p-1.5 hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <label
            htmlFor="paint-scan-input"
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
