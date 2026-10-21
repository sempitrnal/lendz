"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import type { ReleaseRowView } from "@/lib/checklist/release-items";
import { releaseNote } from "@/lib/checklist/release-list";

const AccountForm = dynamic(() => import("@/components/forms/account-form"), {
  loading: () => <FormSkeleton />,
});

/**
 * The create-account sheet for a release item: the real `AccountForm`,
 * prefilled from the typed note, creating without leaving the checklist.
 *
 * The form's own Create button (its last child) is made sticky from here
 * with CSS only, so the form itself is unchanged. There is no schedule
 * preview: it would need the form's live values, which it doesn't expose.
 */
export function CreateAccountSheet({
  release,
  date,
  onCreated,
  onCheckOff,
}: {
  release: ReleaseRowView;
  date: string;
  /**
   * The form created the account (saved, or queued offline). It may come
   * after the sheet has closed; the screen acts on it once per item.
   */
  onCreated(): void;
  /** "Check off without account". */
  onCheckOff(): void;
}) {
  const parsed = release.parsed;
  if (!parsed) return null;
  const note = releaseNote(release.item.label);

  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-lg font-semibold">
        Create account{" "}
        <span className="lowercase">for {parsed.borrowerName}</span>
      </h2>
      {note && (
        <p className="text-sm text-muted-foreground">
          Filled in from your note:{" "}
          <span className="lowercase">“{note}”</span>
        </p>
      )}
      <div
        className="mt-4 [&_form>button:last-child]:sticky
          [&_form>button:last-child]:bottom-3
          [&_form>button:last-child]:z-10
          [&_form>button:last-child]:h-12
          [&_form>button:last-child]:text-base
          [&_form>button:last-child]:shadow-[0_0_0_12px_var(--card)]"
      >
        <AccountForm
          key={`${release.item.id}-${date}`}
          borrowerId={parsed.borrowerId}
          initialValues={parsed.initialValues}
          redirectOnCreate={false}
          borrowerName={parsed.borrowerName}
          onSuccess={onCreated}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        className="mt-5 h-11 w-full"
        onClick={onCheckOff}
      >
        Check off without account
      </Button>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Loading the form</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
        </div>
      ))}
    </div>
  );
}
