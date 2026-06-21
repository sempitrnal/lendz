import { NextResponse } from "next/server";
import { getBorrowerSearchList } from "@/lib/cache/borrowers";

export type BorrowerSearchItem = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  borrower_categories: {
    category: { id: string; name: string; color: string | null }[];
  }[];
};

export async function GET() {
  try {
    const data = await getBorrowerSearchList();
    return NextResponse.json(data as BorrowerSearchItem[]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
