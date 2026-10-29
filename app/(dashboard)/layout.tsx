import { createSupabaseServer } from "@/lib/supabase/server";
import { getSignedInUserId } from "@/lib/supabase/session";
import { isDemoMode } from "@/lib/demo";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import BottomNav from "@/components/bottom-nav";
import SidebarNav from "@/components/sidebar-nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import RealtimeProvider from "@/components/realtime-provider";
import { Suspense } from "react";
import { TourProvider } from "@/components/tours/tour-provider";
import { NavSplash } from "@/components/nav-splash";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSignedInUserId();

  if (!userId) {
    redirect("/login");
  }

  async function logout() {
    "use server";
    if (isDemoMode()) {
      return;
    }
    const sb = await createSupabaseServer();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <>
      <SidebarNav />
      <SiteHeader isLoggedIn logoutAction={logout} />
      <BottomNav />
      <NavSplash />
      <Suspense fallback={null}>
        <TourProvider />
      </Suspense>
      <main
        className="mt-10 flex-1 py-6 sm:mt-0 md:py-0
          md:pl-[calc(var(--sidebar-width))] lg:pl-[calc(var(--sidebar-width))]"
      >
        <RealtimeProvider>
          <PullToRefresh>
            <div className="pb-[52px] sm:pb-0">{children}</div>
          </PullToRefresh>
        </RealtimeProvider>
      </main>
    </>
  );
}
