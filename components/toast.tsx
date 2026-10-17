"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; message: string; type: ToastType; }
let toastId = 0;
let addToastFn: ((message: string, type?: ToastType) => void) | null = null;
export function showToast(message: string, type: ToastType = "success") { addToastFn?.(message, type); }
const ICONS = { success: CheckCircle, error: XCircle, info: AlertCircle };

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pendingTimers = timers.current;
    addToastFn = (message, type = "success") => {
      const id = ++toastId;
      setToasts((previous) => [...previous.slice(-2), { id, message, type }]);
      const timer = setTimeout(() => { setToasts((previous) => previous.filter((toast) => toast.id !== id)); pendingTimers.delete(timer); }, type === "error" ? 10000 : 6000);
      pendingTimers.add(timer);
    };
    return () => { addToastFn = null; pendingTimers.forEach(clearTimeout); pendingTimers.clear(); };
  }, []);
  return <div aria-live="polite" aria-relevant="additions" aria-atomic="false" className="pointer-events-none fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top))] z-[100] mx-auto flex max-w-xl flex-col gap-2">
    {toasts.map((toast) => {
      const Icon = ICONS[toast.type];
      return <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-foreground shadow-lg animate-slide-in"><Icon className={`h-5 w-5 shrink-0 ${toast.type === "error" ? "text-warning" : "text-accent"}`} /><span className="flex-1 text-sm font-medium">{toast.message}</span><button type="button" onClick={() => setToasts((previous) => previous.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted"><X className="h-4 w-4" /></button></div>;
    })}
  </div>;
}
