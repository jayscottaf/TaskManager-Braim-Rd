import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { ToastProvider } from "@/components/toast";
import { LightboxProvider } from "@/components/lightbox";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { AIPanel } from "@/components/ai-panel";
import { Suspense } from "react";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

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
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#181b1a" },
  ],
};

const themeScript = `
(function(){try {
  var t=localStorage.getItem('theme');
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.classList.add('dark');
  }
} catch (_) {}})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground transition-colors">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[110] rounded-lg bg-accent text-on-accent px-4 py-3">Skip to content</a>
        <Suspense fallback={null}><DesktopSidebar /></Suspense>
        <div className="pt-[env(safe-area-inset-top)] lg:pl-56">
          <main id="main-content" className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6 max-w-2xl lg:max-w-6xl mx-auto">{children}</main>
        </div>
        <div className="lg:hidden">
          <Suspense fallback={null}><BottomNav /></Suspense>
        </div>
        <ToastProvider />
        <LightboxProvider />
        <AIPanel />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
