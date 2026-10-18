import type { Metadata } from "next";
import { PageTransition } from "@/components/page-transition";
import { Manrope } from "next/font/google";
import MobileTopBar from "@/components/mobile-top-bar";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { OfflineSyncManager } from "@/components/offline-sync-manager";
import { ConnectionMonitor } from "@/components/connection-monitor";
import { OfflineIndicator } from "@/components/offline-indicator";
import { ThemeProvider } from "./providers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { getSignedInUserId } from "@/lib/supabase/session";

const manrope = Manrope({
  variable: "--font-manrope",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const signedIn = (await getSignedInUserId()) !== null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          <Suspense fallback={null}>
            <ScrollRestoration />
          </Suspense>
          <ServiceWorkerRegistrar />
          <ConnectionMonitor />
          <OfflineSyncManager enabled={signedIn} />
          <OfflineIndicator />

          <PageTransition>{children}</PageTransition>

          <Suspense fallback={null}>
            <MobileTopBar isLoggedIn={signedIn} />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
