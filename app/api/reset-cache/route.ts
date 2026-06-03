import { revalidatePath, updateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const paths = [
    "/",
    "/dashboard",
    "/borrowers",
    "/accounts",
    "/calendar",
    "/next-collection",
  ];

  const tags = [
    "borrowers",
    "borrowers-has-accounts",
    "accounts-page",
    "accounts",
    "account",
    "borrower",
    "borrower-accounts",
    "categories",
    "calendar",
    "dashboard",
    "next-collection",
    "schedules",
  ];

  for (const path of paths) {
    revalidatePath(path);
  }

  for (const tag of tags) {
    updateTag(tag);
  }

  return NextResponse.json({
    ok: true,
    cleared: { paths: paths.length, tags: tags.length },
  });
}
