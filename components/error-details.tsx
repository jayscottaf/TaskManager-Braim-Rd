"use client";

import { useState } from "react";

export function ErrorDetails({ message, code }: { message?: string; code?: string }) {
  const [open, setOpen] = useState(false);

  if (!message && !code) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        {open ? "Hide" : "Technical"} details
      </button>
      {open && (
        <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-2 font-mono">
          {message && <p>{message}</p>}
          {code && <p className="mt-1">Code: {code}</p>}
        </div>
      )}
    </div>
  );
}
