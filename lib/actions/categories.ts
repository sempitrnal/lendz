"use server";

import { getAllCategories } from "@/lib/cache/categories";

export async function fetchCategoriesAction() {
  return getAllCategories();
}
