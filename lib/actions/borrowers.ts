"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";

export async function revalidateBorrowersPage() {
  revalidatePath("/borrowers");
  revalidateTag("borrowers", "default");
  updateTag("borrowers");
  updateTag("accounts-page");
  updateTag("dashboard");
  updateTag("next-collection");
}

export async function revalidateDeletedPage() {
  revalidatePath("/deleted");
  revalidateTag("borrowers", "default");
  updateTag("borrowers");
  updateTag("deleted-borrowers");
  updateTag("deleted-accounts");
  updateTag("accounts-page");
  updateTag("dashboard");
}

export async function revalidateBorrowerDetailPage(borrowerId: string) {
  revalidatePath(`/borrowers/${borrowerId}`);
  revalidatePath("/borrowers");
  revalidateTag("borrowers", "default");
  revalidateTag("borrower-accounts", "default");
  updateTag("borrowers");
  updateTag(`borrower-${borrowerId}`);
  updateTag("borrower-accounts");
  updateTag(`borrower-accounts-${borrowerId}`);
  updateTag("accounts-page");
  updateTag("dashboard");
  updateTag("next-collection");
  revalidateTag("account-detail", "default");
}
