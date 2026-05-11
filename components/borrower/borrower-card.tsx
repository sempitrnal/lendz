"use client"

import { useRouter } from "next/navigation";
import { Borrower } from "./borrower-list";
import { useTransition } from "react";
import { isDarkColor } from "@/lib/utils";
import { Phone } from "lucide-react";
import Link from "next/link";

export function BorrowerCard({ borrower }: { borrower: Borrower }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const categories = [...(borrower.borrower_categories ?? [])].sort((a, b) =>
        a.category.name.localeCompare(b.category.name)
    );
    return (
        <button
            type="button"
            disabled={isPending}
            onClick={() =>
                startTransition(() => {
                    router.push(`/borrowers/${borrower.id}`);
                })
            }
            className="w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-black/20 hover:shadow-md cursor-pointer disabled:cursor-wait disabled:opacity-80"
            aria-busy={isPending}
            aria-label={`Open ${borrower.first_name} ${borrower.last_name}`}
        >
            <div className="rounded-lg">

                <div className="flex justify-between">
                    <div className="flex flex-col">

                        <h2 className="text-lg font-semibold">
                            {borrower.first_name} {borrower.last_name}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {categories && categories.map((e: any) => {
                                const { id, color, name } = e.category
                                return <div
                                    key={id}
                                    className={`rounded px-2 font-medium flex items-center shadow-[2px_2px_0px_#1e1a4d]  shadow`}
                                    style={{ backgroundColor: color ?? "#333", fontSize: 10, color: isDarkColor(color ?? "333") ? "white" : "#1e1a4d", }}
                                >
                                    {name}
                                </div>
                            })}
                        </div>
                    </div>
                    {borrower.contact && <Link href=""><Phone /></Link>}
                </div>
                {/* <p className="text-sm text-gray-500 mt-1">
                    {borrower.contact || "No contact"}
                </p> */}


                <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                    Created{" "}
                    {new Date(borrower.created_at).toLocaleDateString()}
                    {isPending ? (
                        <span className="text-gray-600">Opening...</span>
                    ) : null}
                </div>
            </div>
        </button>
    );
}