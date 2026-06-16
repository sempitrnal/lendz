import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export type BorrowerSearchItem = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  borrower_categories: {
    category: { id: string; name: string; color: string | null };
  }[];
};

export async function GET() {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("borrowers")
    .select(
      `id, first_name, last_name, contact,
       borrower_categories ( category:categories ( id, name, color ) )`,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as BorrowerSearchItem[]);
}
