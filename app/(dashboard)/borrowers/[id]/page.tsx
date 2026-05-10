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

  return (
    <BorrowerDetailView borrower={borrower} />
  );
}
