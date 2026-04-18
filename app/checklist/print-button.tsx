"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
    >
      <Printer className="w-4 h-4" /> Print
    </button>
  );
}
