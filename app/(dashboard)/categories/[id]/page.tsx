

import { BorrowerCard } from "@/components/borrower/borrower-card";
import { Borrower, } from "@/components/borrower/borrower-list";
import AssignBorrower from "@/components/category/assign-borrower";
import { createSupabaseServer } from "@/lib/supabase/server";
export default async function CategoryDetailView({
    params,
}: {
    params: Promise<{ id: string }>;
}) {

    const supabase = await createSupabaseServer();

    const { id: categoryId } = await params;
    const { data: category } = await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .single();
    console.log(category)
    const { data: assigned } = await supabase
        .from("borrower_categories")
        .select(`
      borrower:borrowers (
        id,
        first_name,
        last_name,
        contact,
        created_at
      )
    `)
        .eq("category_id", categoryId);

    const borrowers =
        assigned?.map((row: any) => row.borrower) ?? [];

    const { data: allBorrowers } = await supabase
        .from("borrowers")
        .select("id, first_name, last_name, contact");
    const borrowersList = (allBorrowers ?? []) as Borrower[];
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">{category?.name}</h1>
                {/* <div
                    className="inline-block mt-2 px-2 py-1 rounded text-white text-sm"
                    style={{ backgroundColor: category?.color ?? "#000" }}
                >
                    {category?.name}
                </div> */}
            </div>      <div>
                <h2 className="text-lg font-semibold mb-3">
                    Assigned Borrowers
                </h2>

                {borrowers.length === 0 ? (
                    <p className="text-sm text-gray-500">
                        No borrowers assigned yet
                    </p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {borrowers.map((b: any) => (
                            <BorrowerCard key={b.id} borrower={b} />
                        ))}
                    </div>
                )}
            </div>
            <AssignBorrower initialAssigned={borrowers} categoryId={categoryId} key={categoryId} />
        </div>
    )
}