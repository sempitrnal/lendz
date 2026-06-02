import type { Metadata } from "next";
import { PageTransition } from "@/components/page-transition";
import { Geist, Geist_Mono } from "next/font/google";
import MobileTopBar from "@/components/mobile-top-bar";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineSyncManager } from "@/components/offline-sync-manager";
import { ThemeProvider } from "./providers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import Loading from "./(dashboard)/loading";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Utangz",
  description: "Utangz is a platform for lending and borrowing money",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Utangz",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          <Suspense fallback={null}>
            <ScrollRestoration />
          </Suspense>
          <ServiceWorkerRegistrar />
          <OfflineSyncManager />

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:mt-0 md:px-6">
            <Suspense fallback={<Loading />}>
              <PageTransition>{children}</PageTransition>
            </Suspense>
          </main>

          <Suspense fallback={null}>
            <MobileTopBar />
          </Suspense>
          <Toaster />
          {/* <footer className="border-t border-slate-200 dark:border-border print:hidden">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 text-sm text-slate-600 dark:text-muted-foreground">
              <p>© 2026 Lendz. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
              </div>
            </div>
          </footer> */}
        </ThemeProvider>
      </body>
    </html>
  );
}
