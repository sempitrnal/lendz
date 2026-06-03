import type { Metadata } from "next";
import { PageTransition } from "@/components/page-transition";
import { Geist, Geist_Mono } from "next/font/google";
import MobileTopBar from "@/components/mobile-top-bar";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { OfflineSyncManager } from "@/components/offline-sync-manager";
import { ThemeProvider } from "../providers";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import Loading from "../(dashboard)/loading";

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

export default function MarketingLayout({
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

          <main className="flex-1">
            <Suspense fallback={<Loading />}>
              <PageTransition>{children}</PageTransition>
            </Suspense>
          </main>

          <Suspense fallback={null}>
            <MobileTopBar />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
