"use server";

import { revalidatePath, updateTag } from "next/cache";

export async function revalidateBorrowersPage() {
  revalidatePath("/borrowers");
  updateTag("borrowers");
  updateTag("accounts-page");
  updateTag("next-collection");
}

export async function revalidateDeletedPage() {
  revalidatePath("/deleted");
  updateTag("borrowers");
  updateTag("deleted-borrowers");
  updateTag("deleted-accounts");
  updateTag("accounts-page");
}

export async function revalidateBorrowerDetailPage(borrowerId: string) {
  revalidatePath(`/borrowers/${borrowerId}`);
  revalidatePath("/borrowers");
  updateTag("borrowers");
  updateTag(`borrower-${borrowerId}`);
  updateTag(`borrower-accounts-${borrowerId}`);
  // The page's "recently deleted" list has its own cache.
  updateTag("deleted-accounts");
  updateTag("accounts-page");
  updateTag("next-collection");
  // Creating or editing an account rewrites its schedules.
  updateTag("schedules");
  // Account pages show the borrower's name and categories.
  updateTag("account-detail");
}
