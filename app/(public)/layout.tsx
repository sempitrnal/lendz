import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "../providers";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loan Details",
  description: "View your loan payment schedule and progress",
};

export default function PublicLayout({
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
          <main className="mx-auto w-full max-w-lg flex-1 py-4 sm:py-6 lg:max-w-5xl xl:max-w-6xl">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
