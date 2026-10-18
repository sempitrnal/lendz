"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  NotebookPen,
  Plus,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import BorrowerForm from "@/components/forms/borrower-form";
import AccountForm from "@/components/forms/account-form";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import { borrowerCategoryColor } from "@/lib/checklist/labels";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";

const NotesCanvas = dynamic(() => import("@/components/borrower/notes-canvas"), {
  ssr: false,
});

type Action = "borrower" | "account" | "note";

/** Which step is open: the action menu, a borrower picker, or a form. */
type Step =
  | { kind: "closed" }
  | { kind: "menu" }
  | { kind: "pick"; action: "account" | "note" }
  | { kind: "form"; action: Action; borrower?: Picked };

type Picked = { id: string; name: string };

const ACTIONS: {
  action: Action;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tint: string;
}[] = [
  {
    action: "borrower",
    label: "add borrower",
    hint: "New borrower profile",
    Icon: UserPlus,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    action: "account",
    label: "add account",
    hint: "Loan or cash advance for a borrower",
    Icon: Wallet,
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    action: "note",
    label: "add note",
    hint: "Handwritten note on a borrower",
    Icon: NotebookPen,
    tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
];

const fullName = (b: BorrowerSearchItem) =>
  `${b.first_name} ${b.last_name}`.trim();

/** The "add" tab in the bottom nav and the flows it opens. */
export function QuickActionsButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [mounted, setMounted] = useState(false);
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const menuOpen = step.kind === "menu";
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // On a borrower's page, that borrower is the likely pick.
  const currentBorrowerId = pathname?.match(/^\/borrowers\/([^/]+)/)?.[1];

  const close = () => setStep({ kind: "closed" });

  const choose = (action: Action) =>
    setStep(
      action === "borrower"
        ? { kind: "form", action }
        : { kind: "pick", action },
    );

  const formBorrower = step.kind === "form" ? step.borrower : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setStep({ kind: "menu" })}
        aria-label="Quick actions"
        aria-expanded={menuOpen}
        className="flex flex-1 flex-col items-center justify-center gap-1
          rounded-xl py-2 text-muted-foreground transition-all duration-200
          hover:text-foreground active:bg-muted"
      >
        <span
          className="flex size-5 items-center justify-center rounded-md
            bg-primary text-primary-foreground"
        >
          <Plus className="size-4" strokeWidth={2.75} aria-hidden="true" />
        </span>
        <span className="text-[10px] leading-none font-bold tracking-tight">
          add
        </span>
      </button>

      {mounted &&
        createPortal(
          <div className="md:hidden">
            <div
              onClick={close}
              className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm
              transition-opacity duration-300 ${
                menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Quick actions"
              inert={!menuOpen}
              className={`fixed inset-x-0 bottom-0 z-[9999] transform
              transition-transform duration-300 ease-out ${
                menuOpen ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div
                className="overflow-hidden rounded-t-3xl border-t border-border
                  bg-card pb-[max(env(safe-area-inset-bottom),1.5rem)]
                  shadow-[0_-8px_40px_rgba(0,0,0,0.4)]"
              >
                <div className="flex justify-center pt-3 pb-1">
                  <span
                    className="h-1.5 w-10 rounded-full bg-border"
                    aria-hidden="true"
                  />
                </div>
                <div
                  className="flex items-center justify-between px-5 pt-2 pb-3"
                >
                  <h2 className="text-base font-semibold text-foreground">
                    Quick add
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close quick actions"
                    className="flex size-9 items-center justify-center
                      rounded-full text-muted-foreground transition
                      hover:bg-muted hover:text-foreground active:scale-95"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>
                <ul className="flex flex-col gap-2 px-5">
                  {ACTIONS.map(({ action, label, hint, Icon, tint }) => (
                    <li key={action}>
                      <button
                        type="button"
                        onClick={() => choose(action)}
                        className="flex w-full items-center gap-3 rounded-2xl
                          border border-border bg-background p-3 text-left
                          transition active:scale-[0.98]"
                      >
                        <span
                          className={`flex size-10 shrink-0 items-center
                          justify-center rounded-xl ${tint}`}
                        >
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-sm font-semibold
                              text-foreground"
                          >
                            {label}
                          </span>
                          <span
                            className="block text-xs text-muted-foreground"
                          >
                            {hint}
                          </span>
                        </span>
                        <ChevronRight
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <BorrowerPicker
        open={step.kind === "pick"}
        title={
          step.kind === "pick" && step.action === "note"
            ? "Add note for…"
            : "Add account for…"
        }
        currentBorrowerId={currentBorrowerId}
        onClose={close}
        onPick={(borrower) =>
          step.kind === "pick" &&
          setStep({ kind: "form", action: step.action, borrower })
        }
      />

      <Dialog
        open={step.kind === "form" && step.action === "borrower"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent className="overflow-visible! sm:max-w-md">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold">Add borrower</DialogTitle>
            <DialogDescription>Create a new borrower profile.</DialogDescription>
          </DialogHeader>
          <BorrowerForm onSuccess={close} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={step.kind === "form" && step.action === "account"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Add account
            </DialogTitle>
            <DialogDescription>
              New loan or cash advance for{" "}
              <span className="lowercase">{formBorrower?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          {formBorrower && (
            <AccountForm
              key={formBorrower.id}
              borrowerId={formBorrower.id}
              onSuccess={async () => {
                close();
                await invalidateBorrowerDetails(formBorrower.id);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={step.kind === "form" && step.action === "note"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent
          className="top-[1dvh] h-[98dvh] max-h-[98dvh]
            max-w-[calc(100%-1rem)] translate-y-0 gap-2 rounded-xl p-2 pt-3
            sm:top-1/2 sm:h-[95dvh] sm:max-h-[95dvh] sm:max-w-5xl
            sm:-translate-y-1/2 sm:gap-4 sm:p-6"
        >
          <div className="flex min-h-8 items-center pr-10 pl-1">
            <DialogHeader>
              <DialogTitle>
                New note ·{" "}
                <span className="lowercase">{formBorrower?.name}</span>
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {formBorrower && (
              <NotesCanvas
                key={formBorrower.id}
                borrowerId={formBorrower.id}
                onSaved={() => {
                  void invalidateBorrowerDetails(formBorrower.id);
                  close();
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Searchable borrower list; the borrower whose page is open comes first. */
function BorrowerPicker({
  open,
  title,
  currentBorrowerId,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  currentBorrowerId?: string;
  onClose: () => void;
  onPick: (borrower: Picked) => void;
}) {
  const { data: borrowers = [], isLoading } = useBorrowersSearch();

  const sorted = useMemo(
    () =>
      [...borrowers].sort((a, b) => {
        if (a.id === currentBorrowerId) return -1;
        if (b.id === currentBorrowerId) return 1;
        return fullName(a).localeCompare(fullName(b));
      }),
    [borrowers, currentBorrowerId],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Pick a borrower.</DialogDescription>
        </DialogHeader>
        <Command className="rounded-xl border border-border">
          <CommandInput placeholder="Search borrowers…" autoFocus />
          <CommandList className="max-h-[50dvh]">
            <CommandEmpty>
              {isLoading ? "Loading borrowers…" : "No borrower found."}
            </CommandEmpty>
            <CommandGroup>
              {sorted.map((b) => {
                const name = fullName(b);
                const color = borrowerCategoryColor(b);
                return (
                  <CommandItem
                    key={b.id}
                    // Unique value so two borrowers with one name both show.
                    value={`${name} ${b.id}`}
                    keywords={[name]}
                    onSelect={() => onPick({ id: b.id, name })}
                    className="py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: color ?? "var(--muted-foreground)",
                        opacity: color ? 1 : 0.4,
                      }}
                    />
                    <span className="truncate lowercase">{name}</span>
                    {b.id === currentBorrowerId && (
                      <span
                        className="ml-1 rounded-full bg-primary/10 px-1.5
                          text-[10px] font-medium text-primary"
                      >
                        this page
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
