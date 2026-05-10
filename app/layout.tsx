import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import "./globals.css";

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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function logout() {
    "use server";

    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased `}
    >
      <body className="min-h-full flex flex-col bg-[#fffefa] text-slate-900">
        <SiteHeader isLoggedIn={Boolean(user)} logoutAction={logout} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 md:px-6 py-10 ">{children}</main>

        <footer className="border-t border-slate-200">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 text-sm text-slate-600">
            <p>© {new Date().getFullYear()} Lendz. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
