import { createClient } from "@supabase/supabase-js";
function createSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
}

export type CategoryRow = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  created_at: string;
  borrower_categories?: { count: number }[];
};

export async function getAllCategories() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, name, color, sort_order, created_at, borrower_categories(count)",
    )
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

export async function getCategoryById(id: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as CategoryRow | null;
}

export async function getCategoryBorrowers(categoryId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("borrower_categories")
    .select(
      `
      borrower:borrowers (
        id,
        first_name,
        last_name,
        contact,
        created_at
      )
    `,
    )
    .eq("category_id", categoryId);

  if (error) throw error;
  const borrowers = (data ?? [])
    .map((row: any) => row.borrower)
    .filter(Boolean) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    contact: string | null;
    created_at: string;
  }>;
  return borrowers;
}
