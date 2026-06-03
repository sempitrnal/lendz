import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-[70vh] w-full place-items-center">
      <LoginForm />
    </div>
  );
}
