import { cache } from "react";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * The signed-in user's id, or null. Verifies the session's JWT with
 * `getClaims()`, which with asymmetric signing keys checks it locally instead
 * of calling Supabase Auth on every render (each call is a logged request).
 * Wrapped in `cache` so the root and dashboard layouts share one check per
 * request.
 */
export const getSignedInUserId = cache(async (): Promise<string | null> => {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
});
