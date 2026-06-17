import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import BottomNav from "@/components/bottom-nav";
import SidebarNav from "@/components/sidebar-nav";

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
        className="mx-auto w-full max-w-7xl mt-10 flex-1 px-4 py-10 sm:mt-0
          md:px-10 md:pl-[calc(var(--sidebar-width)+1.5rem)]
          lg:pl-[calc(var(--sidebar-width)+2.5rem)]"
      >
        <div className="pb-[52px] sm:pb-0">{children}</div>
      </main>
    </>
  );
}
