import { createSupabaseServer } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import BottomNav from "@/components/bottom-nav";
import SidebarNav from "@/components/sidebar-nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import RealtimeProvider from "@/components/realtime-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
      <SiteHeader isLoggedIn={Boolean(user)} logoutAction={logout} />
      <BottomNav />
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
