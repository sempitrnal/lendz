import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DEMO_USER, isDemoMode } from "@/lib/demo";

export async function createSupabaseServer() {
  if (isDemoMode()) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error(
        "Demo mode requires SUPABASE_SERVICE_ROLE_KEY to be set in the environment.",
      );
    }

    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // no-op
          },
        },
      },
    );

    // In demo there is no real session, but the UI expects a logged-in user.
    // Stub auth.getUser so layouts/renders treat the demo as authenticated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.auth as any).getUser = async () => ({
      data: { user: DEMO_USER },
      error: null,
    });

    // signOut is a no-op in demo; there is no session to terminate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client.auth as any).signOut = async () => ({ error: null });

    return client;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can read cookies but cannot mutate them.
            // Cookie refresh should happen in Route Handlers or Server Actions.
          }
        },
      },
    },
  );
}
