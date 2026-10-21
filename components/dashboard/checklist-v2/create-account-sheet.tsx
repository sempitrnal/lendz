"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formFieldErrorClassName } from "@/lib/form-field-classes";
import type { ReleaseRowView } from "@/lib/checklist/release-items";
import {
  classifySubmitSample,
  CREATE_AGAIN_WARNING,
  needsCreateConfirm,
  releaseNote,
  type CreateEvent,
  type CreateMark,
} from "@/lib/checklist/release-list";

const AccountForm = dynamic(() => import("@/components/forms/account-form"), {
  loading: () => <FormSkeleton />,
});

/** The form's own submit button (its last child); the sticky CSS uses it too. */
const SUBMIT_BUTTON = "form > button:last-child";
/** How often the form is sampled after a submit. */
const SAMPLE_MS = 100;

/**
 * The create-account sheet for a release item: the real `AccountForm`,
 * prefilled from the typed note, creating without leaving the checklist.
 *
 * The form's own Create button (its last child) is made sticky from here
 * with CSS only, so the form itself is unchanged. There is no schedule
 * preview: it would need the form's live values, which it doesn't expose.
 *
 * Guarding against a second account, from outside the form:
 * - A submit is caught on its way to the form (capture phase). While the
 *   item is "attempted" it is held back: the warning asks for "Create
 *   anyway" first.
 * - Otherwise it reports "submit" and samples the form every 100 ms
 *   (`classifySubmitSample`): a field error once the button is enabled is a
 *   failed validation ("invalid", back to idle); the button seen busy and
 *   enabled again with no error is a real submit that ended ("ended": it may
 *   have saved the account, since the form resets before its last await and
 *   onSuccess), as is no sign either way after a second.
 * - The sheet going away mid-run reports "lost". All of these resolve to
 *   "created" whenever the form's onSuccess arrives.
 */
export function CreateAccountSheet({
  release,
  date,
  mark,
  getMark,
  onCreateEvent,
  onCreated,
  onCheckOff,
  onOpenBorrower,
}: {
  release: ReleaseRowView;
  date: string;
  /** This item's create mark, for rendering. */
  mark: CreateMark | undefined;
  /** The same mark as of now (handlers run between renders). */
  getMark(): CreateMark | undefined;
  onCreateEvent(type: Exclude<CreateEvent["type"], "success">): void;
  /**
   * The form created the account (saved, or queued offline). It may come
   * after the sheet has closed; the screen acts on it once per item.
   */
  onCreated(): void;
  /** "Check off without account". */
  onCheckOff(): void;
  onOpenBorrower(): void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const warningRef = useRef<HTMLDivElement>(null);
  /** Opened on an earlier attempt: no form until "Create anyway". */
  const [showForm, setShowForm] = useState(() => !needsCreateConfirm(mark));
  /** Bumped by "Create anyway" so a fresh, prefilled form mounts. */
  const [formKey, setFormKey] = useState(0);
  /** A submit held back while "attempted"; highlights the warning. */
  const [heldBack, setHeldBack] = useState(false);

  const eventRef = useRef(onCreateEvent);
  useEffect(() => {
    eventRef.current = onCreateEvent;
  }, [onCreateEvent]);
  /** Stops watching the form (one watch at a time); true if one was running. */
  const stopWatchRef = useRef<(() => boolean) | null>(null);
  useEffect(
    () => () => {
      // Gone mid-run (the sheet closed on a remote change): an account may
      // exist, so it falls to "attempted" until onSuccess says otherwise.
      if (stopWatchRef.current?.()) eventRef.current("lost");
    },
    [],
  );

  const watchSubmit = () => {
    stopWatchRef.current?.();
    const started = Date.now();
    let seenBusy = false;
    const timer = window.setInterval(() => {
      const wrap = wrapRef.current;
      const button = wrap?.querySelector<HTMLButtonElement>(SUBMIT_BUTTON);
      if (!wrap || !button) return;
      if (button.disabled) seenBusy = true;
      const fieldErrors = [...wrap.querySelectorAll("form p")].filter(
        (p) => p.className === formFieldErrorClassName,
      ).length;
      const verdict = classifySubmitSample({
        buttonDisabled: button.disabled,
        seenBusy,
        fieldErrors,
        elapsedMs: Date.now() - started,
      });
      if (verdict === "wait") return;
      stop();
      eventRef.current(verdict);
    }, SAMPLE_MS);
    const stop = () => {
      window.clearInterval(timer);
      stopWatchRef.current = null;
      return true;
    };
    stopWatchRef.current = stop;
  };

  const onSubmitCapture = (e: FormEvent) => {
    const now = getMark();
    if (needsCreateConfirm(now)) {
      // Never reaches the form: an earlier run may have made the account.
      e.preventDefault();
      e.stopPropagation();
      setHeldBack(true);
      warningRef.current?.scrollIntoView({ block: "nearest" });
      return;
    }
    // The button is disabled while busy, but the form re-enables it a moment
    // before it finishes (it resets, then waits on a server call). A submit
    // in that gap would be a second account, so hold it back.
    if (now === "creating" || now === "created") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    eventRef.current("submit");
    watchSubmit();
  };

  const createAnyway = () => {
    onCreateEvent("confirm");
    setHeldBack(false);
    setShowForm(true);
    setFormKey((k) => k + 1);
  };

  const parsed = release.parsed;
  if (!parsed) return null;
  const note = releaseNote(release.item.label);
  const attempted = needsCreateConfirm(mark);

  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-lg font-semibold">
        Create account{" "}
        <span className="lowercase">for {parsed.borrowerName}</span>
      </h2>
      {note && (
        <p className="text-sm text-muted-foreground">
          Filled in from your note: <span className="lowercase">“{note}”</span>
        </p>
      )}
      {attempted && (
        <div
          ref={warningRef}
          role="alert"
          className={`mt-4 rounded-xl border p-3 text-sm ${
            heldBack
              ? "border-destructive bg-destructive/10"
              : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          <p className="flex gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>{CREATE_AGAIN_WARNING}</span>
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={onOpenBorrower}
            >
              Open borrower page
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={createAnyway}
            >
              Create anyway
            </Button>
          </div>
        </div>
      )}
      {showForm && (
        <div
          ref={wrapRef}
          onSubmitCapture={onSubmitCapture}
          className="mt-4 [&_form>button:last-child]:sticky
            [&_form>button:last-child]:bottom-3 [&_form>button:last-child]:z-10
            [&_form>button:last-child]:h-12 [&_form>button:last-child]:text-base
            [&_form>button:last-child]:shadow-[0_0_0_12px_var(--card)]"
        >
          <AccountForm
            key={`${release.item.id}-${date}-${formKey}`}
            borrowerId={parsed.borrowerId}
            initialValues={parsed.initialValues}
            redirectOnCreate={false}
            borrowerName={parsed.borrowerName}
            onSuccess={onCreated}
          />
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        If an error shows after Create, check the borrower page before trying
        again.
      </p>
      <Button
        type="button"
        variant="ghost"
        className="mt-2 h-11 w-full"
        disabled={mark === "creating"}
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
