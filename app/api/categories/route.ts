import { NextResponse } from "next/server";
import { getAllCategories } from "@/lib/cache/categories";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Every category, as a GET so the service worker can save it for offline (a
 * server action is a POST, which offline gets queued like an edit).
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getAllCategories());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
