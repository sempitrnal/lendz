"use server";

import { revalidatePath, updateTag } from "next/cache";

export async function revalidateBorrowersPage() {
  revalidatePath("/borrowers");
  updateTag("borrowers");
  updateTag("accounts-page");
  updateTag("dashboard");
  updateTag("next-collection");
}

export async function revalidateBorrowerDetailPage(borrowerId: string) {
  revalidatePath(`/borrowers/${borrowerId}`);
  revalidatePath("/borrowers");
  updateTag("borrowers");
  updateTag(`borrower-accounts-${borrowerId}`);
  updateTag("accounts-page");
  updateTag("dashboard");
  updateTag("next-collection");
}
