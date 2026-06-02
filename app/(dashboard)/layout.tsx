import { createSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import BottomNav from "@/components/bottom-nav";
import { Suspense } from "react";

async function AuthHeaderAndNav() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function logout() {
    "use server";
    const sb = await createSupabaseServer();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <>
      <SiteHeader isLoggedIn={Boolean(user)} logoutAction={logout} />
      {Boolean(user) && <BottomNav />}
    </>
  );
}

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

  return (
    <>
      <Suspense
        fallback={
          <div className="dark:bg-card dark:border-border h-16 border-b border-slate-200 bg-white" />
        }
      >
        <AuthHeaderAndNav />
      </Suspense>
      <div className="pb-[52px] sm:pb-0">{children}</div>
    </>
  );
}
