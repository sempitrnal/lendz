import type { Metadata } from "next";
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
import { FONT_SCALE_INIT_SCRIPT } from "@/lib/font-scale";

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

/**
 * The pieces that need to know whether someone is signed in. They resolve on
 * their own, so the page doesn't wait on the session check before it starts
 * to render.
 */
async function SessionAwareClients() {
  const signedIn = (await getSignedInUserId()) !== null;
  return (
    <>
      <OfflineSyncManager enabled={signedIn} />
      <MobileTopBar isLoggedIn={signedIn} />
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FONT_SCALE_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          <Suspense fallback={null}>
            <ScrollRestoration />
          </Suspense>
          <ServiceWorkerRegistrar />
          <ConnectionMonitor />
          <OfflineIndicator />

          {children}

          <Suspense fallback={null}>
            <SessionAwareClients />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
