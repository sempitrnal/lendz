import BorrowerEditView from "@/components/borrower/borrower-edit-view";
import { createSupabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type EditBorrowerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditBorrowerPage({
  params,
}: EditBorrowerPageProps) {
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
    <BorrowerEditView
      borrowerId={borrower.id}
      initial={{
        first_name: borrower.first_name,
        last_name: borrower.last_name,
        contact: borrower.contact,
      }}
    />
  );
}
