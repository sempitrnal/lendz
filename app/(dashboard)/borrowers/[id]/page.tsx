import BorrowerDetailView from "@/components/borrower/borrower-detail-view";
import { createSupabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type BorrowerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BorrowerPage({
  params,
}: BorrowerPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: borrower, error } = await supabase
    .from("borrowers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !borrower) {
    notFound();
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("borrower_id", borrower.id)
    .order("created_at", { ascending: false });

  return (
    <BorrowerDetailView borrower={borrower} accounts={accounts} />
  );
}
