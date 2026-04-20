import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { ToastProvider } from "@/components/toast";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

const themeScript = `
(function(){
  var t=localStorage.getItem('theme');
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.classList.add('dark');
  }
})();
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
      <body className="min-h-full bg-[#fafafa] dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 transition-colors">
        <DesktopSidebar />
        <div className="pt-[env(safe-area-inset-top)] lg:pl-56">
          <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400" />
          <main className="pb-20 lg:pb-6 max-w-2xl lg:max-w-6xl mx-auto">{children}</main>
        </div>
        <div className="lg:hidden">
          <BottomNav />
        </div>
        <ToastProvider />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
