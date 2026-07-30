"use server";

import { revalidatePath } from "next/cache";
import { purgeOldDeletedItems } from "@/lib/purge-deleted";

export async function purgeOldDeletedItemsAction() {
  const result = await purgeOldDeletedItems();

  revalidatePath("/deleted");
  revalidatePath("/borrowers");

  return result;
}
