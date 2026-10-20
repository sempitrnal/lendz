import { NextResponse } from "next/server";
import { getBorrowerSearchList } from "@/lib/cache/borrowers";
import { getSignedInUserId } from "@/lib/supabase/session";

export type BorrowerSearchItem = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  borrower_categories: {
    category: {
      id: string;
      name: string;
      color: string | null;
      sort_order?: number | null;
    }[];
  }[];
};

export async function GET() {
  // Reads with the service role, so the session is checked here.
  if (!(await getSignedInUserId())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  try {
    const data = await getBorrowerSearchList();
    return NextResponse.json(data as BorrowerSearchItem[]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
