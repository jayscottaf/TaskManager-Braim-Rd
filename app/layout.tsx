import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { ToastProvider } from "@/components/toast";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskTracker - Braim Rd",
  description: "Home maintenance tracker for Braim Rd, Saratoga Springs",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaskTracker",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full bg-[#fafafa] text-neutral-950">
        <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400" />
        <main className="pb-20 max-w-2xl mx-auto">{children}</main>
        <BottomNav />
        <ToastProvider />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
