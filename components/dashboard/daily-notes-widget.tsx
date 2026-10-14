"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import AccountForm from "@/components/forms/account-form";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import {
  parseReleasedLabel,
  type ParsedReleasedLabel,
} from "@/lib/checklist/released";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type {
  ChecklistCategory,
  DailyChecklistItem,
  DueChecklistGroup,
} from "@/lib/checklist/types";
import {
  buildDueLabel,
  collectionRowModel,
  groupByBorrowerCategory,
  extractScheduleRefs,
  type NextCollectionItem,
} from "@/lib/checklist/labels";
import { summarizeChecklist } from "@/lib/checklist/totals";
import {
  formatLongDate,
  overdueCutoffDateValue,
  relativeDayLabel,
  shiftDateValue,
  todayDateValue,
} from "@/lib/checklist/dates";
import {
  ChecklistInput,
  type ChecklistInputHandle,
} from "@/components/dashboard/checklist/checklist-input";
import {
  NEAR_WHITE_BORDER,
  isNearWhite,
} from "@/components/dashboard/checklist/dom";
import {
  CollectionLabel,
  LinkedLabel,
} from "@/components/dashboard/checklist/checklist-label";
import {
  BulkPaidDialog,
  ScheduleCheckDialog,
} from "@/components/dashboard/checklist/payment-dialogs";

/** Category tints, mixed in CSS from `--cat` so they follow the theme. */
const CAT_PILL =
  "border-[color:color-mix(in_oklab,var(--cat)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--cat)_14%,var(--card))] text-[color:color-mix(in_oklab,var(--cat)_70%,var(--foreground))]";
const CAT_HEADER = "bg-[color:color-mix(in_oklab,var(--cat)_6%,var(--card))]";

/** Borrower-category sub-header tint, from `--grp`; kept off the muted checked-row fill. */
const GROUP_HEADER =
  "bg-[color:color-mix(in_oklab,var(--grp)_6.7%,var(--card))]";

/** Neutral highlight; the theme's accent (amber) reads as a warning here. */
const MENU_ITEM =
  "focus:bg-muted focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground";

const ICON_BUTTON =
  "inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground";

function CategorySection({
  category,
  items,
  date,
  onAdd,
  onToggle,
  onDelete,
  onClear,
  onEditLabel,
  onPopulate,
  onUndoPopulate,
  onCheckMany,
}: {
  category: ChecklistCategory | null;
  items: DailyChecklistItem[];
  date: string;
  onAdd: (
    label: string,
    categoryId: string | null,
    date: string,
  ) => Promise<void>;
  onToggle: (item: DailyChecklistItem) => void;
  onDelete: (id: string) => void;
  onClear: (ids: string[]) => void;
  onEditLabel: (itemId: string, newLabel: string) => void;
  onPopulate: (categoryId: string | null, date: string) => Promise<void>;
  onUndoPopulate?: () => void;
  onCheckMany: (ids: string[]) => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyChecklistItem | null>(
    null,
  );
  const [editLabelValue, setEditLabelValue] = useState("");
  const [scheduleCheckItem, setScheduleCheckItem] =
    useState<DailyChecklistItem | null>(null);
  const [releasedAccount, setReleasedAccount] = useState<{
    item: DailyChecklistItem;
    parsed: ParsedReleasedLabel;
  } | null>(null);
  const router = useRouter();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const addInputRef = useRef<ChecklistInputHandle>(null);
  const editInputRef = useRef<ChecklistInputHandle>(null);
  const [expanded, setExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const { data: borrowers = [] } = useBorrowersSearch();

  const getBorrowerNextAmounts = useCallback(
    async (borrowerId: string): Promise<NextCollectionItem[]> => {
      try {
        const res = await fetch(`/api/borrowers/${borrowerId}/details`);
        if (!res.ok) return [];
        const data = (await res.json()) as {
          accounts: Array<Record<string, unknown>>;
          metrics: Record<string, Record<string, unknown>>;
        };
        const items: NextCollectionItem[] = [];
        for (const a of data.accounts) {
          if (
            a.schedule_mode === "manual" ||
            (a.type !== "loan" && a.type !== "cash_advance")
          )
            continue;
          const m = data.metrics[a.id as string];
          const collections =
            (m?.dueCollections as NextCollectionItem[] | undefined) ?? [];
          for (const c of collections) {
            const amount = Number(c.amount ?? 0);
            const due_date = String(c.due_date ?? "").slice(0, 10);
            if (amount <= 0 || !due_date) continue;
            items.push({
              id: String((c as { id?: unknown }).id ?? ""),
              due_date,
              amount,
              type: String(a.type ?? ""),
            });
          }
        }
        const overdueCutoff = overdueCutoffDateValue();
        items.sort((a, b) => {
          const overdueDiff =
            (a.due_date < overdueCutoff ? 0 : 1) -
            (b.due_date < overdueCutoff ? 0 : 1);
          if (overdueDiff !== 0) return overdueDiff;
          const byDate = a.due_date.localeCompare(b.due_date);
          if (byDate !== 0) return byDate;
          return a.type.localeCompare(b.type);
        });
        return items;
      } catch {
        return [];
      }
    },
    [],
  );

  const checkedCount = items.filter((i) => i.is_checked).length;
  const totals = useMemo(() => summarizeChecklist(items), [items]);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.created_at.localeCompare(a.created_at);
      }),
    [items],
  );

  const bulkItems = useMemo(
    () =>
      sorted.filter(
        (i) => !i.is_checked && extractScheduleRefs(i.label).length > 0,
      ),
    [sorted],
  );

  const handleAdd = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAdd(trimmed, category?.id ?? null, date);
    setSaving(false);
    setNewLabel("");
    addInputRef.current?.clear();
  };

  const handleEditSave = (value: string) => {
    if (!editingItem) return;
    const trimmed = value.trim();
    if (trimmed) onEditLabel(editingItem.id, trimmed);
    setEditingItem(null);
    setEditLabelValue("");
  };

  const handleToggle = (item: DailyChecklistItem) => {
    if (!item.is_checked) {
      const refs = extractScheduleRefs(item.label);
      if (refs.length > 0) {
        setScheduleCheckItem(item);
        return;
      }
      if (category?.name.trim().toLowerCase() === "released") {
        const parsed = parseReleasedLabel(item.label, item.checklist_date);
        if (parsed) {
          setReleasedAccount({ item, parsed });
          return;
        }
      }
    }
    onToggle(item);
  };

  useEffect(() => {
    if (editingItem) setEditLabelValue(editingItem.label);
  }, [editingItem]);

  const isReleasedCategory = category?.name.trim().toLowerCase() === "released";

  const rows = useMemo(
    () =>
      sorted.map((item) => ({
        item,
        collection: collectionRowModel(item.label, item.checklist_date),
        canCreateAccount:
          isReleasedCategory &&
          !item.is_checked &&
          parseReleasedLabel(item.label, item.checklist_date) !== null,
      })),
    [sorted, isReleasedCategory],
  );

  const groups = useMemo(
    () =>
      groupByBorrowerCategory(rows, (r) => r.item.label, borrowers).map(
        (group) => ({
          ...group,
          checked: group.rows.filter((r) => r.item.is_checked).length,
          totals: summarizeChecklist(group.rows.map((r) => r.item)),
        }),
      ),
    [rows, borrowers],
  );

  return (
    <div
      className="rounded-2xl border border-border bg-card shadow-sm
        transition-all duration-200"
      style={
        {
          "--cat": category?.color ?? "var(--muted-foreground)",
        } as React.CSSProperties
      }
    >
      <div
        className={`flex items-center gap-1 pr-2 ${CAT_HEADER} ${
          expanded ? "rounded-t-2xl border-b border-border" : "rounded-2xl"
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-4
            text-left"
        >
          <span
            className={`inline-flex min-w-0 items-center truncate rounded-full
              border px-2.5 py-0.5 text-xs font-semibold lowercase ${CAT_PILL}`}
          >
            {category?.name ?? "uncategorized"}
          </span>
          <span
            className="shrink-0 text-xs font-medium text-muted-foreground
              tabular-nums"
          >
            {checkedCount}/{items.length}
          </span>
          {totals.collections > 0 && (
            <span
              className="truncate text-xs font-medium text-muted-foreground
                tabular-nums"
            >
              · ₱{totals.left.toLocaleString()} left
            </span>
          )}
          <ChevronDown
            className={`ml-auto size-4 shrink-0 text-muted-foreground
              transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`${category?.name ?? "Uncategorized"} options`}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            <DropdownMenuItem
              className={MENU_ITEM}
              disabled={populating}
              onSelect={async () => {
                setPopulating(true);
                await onPopulate(category?.id ?? null, date);
                setPopulating(false);
              }}
            >
              <Plus />
              {populating ? "Loading…" : "Populate due"}
            </DropdownMenuItem>
            {bulkItems.length > 0 && (
              <DropdownMenuItem
                className={MENU_ITEM}
                onSelect={() => setBulkOpen(true)}
              >
                <Check />
                Mark all paid ({bulkItems.length})
              </DropdownMenuItem>
            )}
            {onUndoPopulate && (
              <DropdownMenuItem variant="destructive" onSelect={onUndoPopulate}>
                <Undo2 />
                Undo populate
              </DropdownMenuItem>
            )}
            {items.length > 0 && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onClear(items.map((i) => i.id))}
              >
                <Trash2 />
                Clear all ({items.length})
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <>
          <div className="flex items-end gap-2 px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <ChecklistInput
                ref={addInputRef}
                defaultValue=""
                onChange={setNewLabel}
                onSubmit={handleAdd}
                placeholder={`Add item${category ? ` to ${category.name}` : ""}…`}
                borrowers={borrowers}
                getBorrowerNextAmounts={getBorrowerNextAmounts}
                showPesoButton
              />
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addInputRef.current?.submit()}
              disabled={saving || !newLabel.trim()}
              aria-label="Add item"
              title="Add item"
              className="inline-flex size-10 shrink-0 items-center
                justify-center rounded-xl bg-foreground text-background
                transition-opacity duration-200 hover:opacity-80
                disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>

          {sorted.length === 0 ? (
            <div className="px-3 pb-4 sm:px-4">
              <div
                className="flex flex-col items-center gap-2 rounded-xl border
                  border-dashed border-border bg-muted/30 py-8 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  No items in this category yet.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="divide-y divide-border overflow-hidden rounded-b-2xl
                border-t border-border"
            >
              {groups.map((group) => (
                <div
                  key={group.key}
                  style={
                    group.color
                      ? ({ "--grp": group.color } as React.CSSProperties)
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={!collapsedGroups.has(group.key)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5
                      text-left text-[11px] font-semibold lowercase
                      text-slate-700 sm:px-4 dark:text-slate-300 ${
                        group.color ? GROUP_HEADER : "bg-card"
                      }`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          group.color ?? "var(--muted-foreground)",
                        opacity: group.color ? 1 : 0.4,
                        boxShadow:
                          group.color && isNearWhite(group.color)
                            ? `inset 0 0 0 1px ${NEAR_WHITE_BORDER}`
                            : undefined,
                      }}
                    />
                    <span className="truncate">{group.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {group.checked}/{group.rows.length}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {group.totals.collections > 0 && (
                        <span className="tabular-nums">
                          ₱{group.totals.left.toLocaleString()} left
                        </span>
                      )}
                      <ChevronDown
                        className={`size-3.5 transition-transform duration-200
                          ${
                            collapsedGroups.has(group.key) ? "-rotate-90" : ""
                          }`}
                      />
                    </span>
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows]
                      duration-300 ease-in-out ${
                        collapsedGroups.has(group.key)
                          ? "grid-rows-[0fr]"
                          : "grid-rows-[1fr]"
                      }`}
                    inert={collapsedGroups.has(group.key)}
                  >
                    <div className="overflow-hidden">
                      <ul
                        className="divide-y divide-border border-t
                          border-border"
                      >
                        {group.rows.map(
                          ({ item, collection, canCreateAccount }) => (
                            <li
                              key={item.id}
                              onClick={() => handleToggle(item)}
                              className={`group flex cursor-pointer items-start
                                gap-3 px-3 py-3 transition-colors duration-200
                                sm:px-4 ${
                                  item.is_checked
                                    ? "bg-muted/20"
                                    : "hover:bg-muted/30"
                                }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggle(item);
                                }}
                                title={item.is_checked ? "Uncheck" : "Check"}
                                className={`mt-0.5 flex size-5 shrink-0
                                  items-center justify-center rounded-full
                                  border-2 p-0 transition-all duration-200 ${
                                    item.is_checked
                                      ? `border-emerald-500 bg-emerald-500
                                        text-white`
                                      : `border-muted-foreground/40
                                        text-transparent
                                        hover:border-emerald-400`
                                  }`}
                                aria-label={
                                  item.is_checked ? "Uncheck" : "Check"
                                }
                              >
                                <Check className="size-2.5" strokeWidth={2} />
                              </button>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                {collection ? (
                                  <CollectionLabel
                                    model={collection}
                                    checked={item.is_checked}
                                    borrowers={borrowers}
                                  />
                                ) : (
                                  <span
                                    className={`block text-sm font-medium
                                      break-words whitespace-pre-wrap
                                      transition-colors duration-200 ${
                                        item.is_checked
                                          ? "text-muted-foreground"
                                          : "text-foreground"
                                      }`}
                                  >
                                    <LinkedLabel
                                      label={item.label}
                                      checked={item.is_checked}
                                      borrowers={borrowers}
                                    />
                                  </span>
                                )}
                                {canCreateAccount && (
                                  <span
                                    className="mt-1.5 inline-flex items-center
                                      gap-1 rounded-md bg-emerald-500/10 px-1.5
                                      py-0.5 text-[11px] font-semibold
                                      text-emerald-700 dark:text-emerald-300"
                                  >
                                    create account
                                    <ArrowRight className="size-3" />
                                  </span>
                                )}
                              </div>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className={`-my-1 ${ICON_BUTTON}`}
                                    aria-label="More options"
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-auto min-w-32"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DropdownMenuItem
                                    className={MENU_ITEM}
                                    onSelect={() => {
                                      setEditingItem(item);
                                      setEditLabelValue(item.label);
                                    }}
                                  >
                                    <Pencil />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => onDelete(item.id)}
                                  >
                                    <Trash2 />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!editingItem}
        onOpenChange={(v) => {
          if (!v) setEditingItem(null);
        }}
      >
        <DialogContent
          className="overflow-visible! sm:max-w-md"
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement).closest("[data-next-dropdown]")) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="gap-3 pb-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full
                bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40
                dark:text-indigo-300"
            >
              <Pencil className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Edit Item
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update the label for this checklist item.
              </DialogDescription>
            </div>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 pt-2">
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium
                    text-muted-foreground"
                >
                  Label
                </label>
                <ChecklistInput
                  key={editingItem.id}
                  ref={editInputRef}
                  defaultValue={editingItem.label}
                  onChange={setEditLabelValue}
                  onSubmit={handleEditSave}
                  placeholder="Edit item label…"
                  borrowers={borrowers}
                  getBorrowerNextAmounts={getBorrowerNextAmounts}
                  showPesoButton
                />
                <button
                  type="button"
                  onClick={() => editInputRef.current?.openNext()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg
                    border border-border bg-card px-3 py-1.5 text-xs
                    font-semibold text-foreground transition-colors
                    hover:bg-muted"
                >
                  <Plus className="size-3.5" />
                  Add / remove collections
                </button>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => editInputRef.current?.submit()}
                  disabled={!editLabelValue.trim()}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BulkPaidDialog
        items={bulkOpen ? bulkItems : null}
        categoryName={category?.name ?? "this category"}
        onClose={() => setBulkOpen(false)}
        onConfirmed={(ids) => {
          setBulkOpen(false);
          onCheckMany(ids);
        }}
      />

      <ScheduleCheckDialog
        item={scheduleCheckItem}
        onClose={() => setScheduleCheckItem(null)}
        onConfirmed={() => {
          const item = scheduleCheckItem;
          setScheduleCheckItem(null);
          if (item) onToggle(item);
        }}
      />

      <Dialog
        open={Boolean(releasedAccount)}
        onOpenChange={(open) => {
          if (!open) setReleasedAccount(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Create account for {releasedAccount?.parsed.borrowerName}
            </DialogTitle>
            <DialogDescription>
              Prefilled from the checklist item. Review and save to check it
              off.
            </DialogDescription>
          </DialogHeader>
          {releasedAccount ? (
            <>
              <AccountForm
                key={releasedAccount.item.id}
                borrowerId={releasedAccount.parsed.borrowerId}
                initialValues={releasedAccount.parsed.initialValues}
                redirectOnCreate={false}
                borrowerName={releasedAccount.parsed.borrowerName}
                onSuccess={async () => {
                  const { item, parsed } = releasedAccount;
                  setReleasedAccount(null);
                  onToggle(item);
                  await invalidateBorrowerDetails(parsed.borrowerId);
                  router.refresh();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const { item } = releasedAccount;
                  setReleasedAccount(null);
                  onToggle(item);
                }}
              >
                Check off without account
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DailyNotesWidget() {
  const [items, setItems] = useState<DailyChecklistItem[]>([]);
  const itemsRef = useRef<DailyChecklistItem[]>([]);
  const [lastPopulate, setLastPopulate] = useState<{
    date: string;
    categoryId: string | null;
    rows: { id: string; label: string }[];
  } | null>(null);
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [date, setDate] = useState(todayDateValue());
  const [loading, setLoading] = useState(true);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("daily_checklist_categories")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((data ?? []) as ChecklistCategory[]);
  };

  const loadItems = async (targetDate: string, withLoading = true) => {
    if (withLoading) setLoading(true);
    const { data, error } = await supabase
      .from("daily_checklist_items")
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id, daily_checklist_categories(id, name, color, sort_order)",
      )
      .eq("checklist_date", targetDate)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      if (withLoading) setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: Record<string, unknown>) => {
      const cat = row.daily_checklist_categories as
        | ChecklistCategory
        | null
        | unknown[];
      return {
        ...(row as DailyChecklistItem),
        daily_checklist_categories:
          Array.isArray(cat) && cat.length > 0
            ? (cat[0] as ChecklistCategory)
            : cat && !Array.isArray(cat)
              ? (cat as ChecklistCategory)
              : null,
      };
    }) as DailyChecklistItem[];

    setItems(normalized);
    if (withLoading) setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
    void loadItems(date);
  }, [date]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`daily-checklist-items-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_checklist_items",
          filter: `checklist_date=eq.${date}`,
        },
        () => {
          if (refreshTimerRef.current) {
            window.clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = window.setTimeout(() => {
            void loadItems(date, false);
          }, 300);
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadItems(date, false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [date]);

  const editItemLabel = (itemId: string, newLabel: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === itemId ? { ...row, label: newLabel } : row,
      ),
    );

    supabase
      .from("daily_checklist_items")
      .update({ label: newLabel })
      .eq("id", itemId)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
        }
      });
  };

  const addItem = async (
    label: string,
    categoryId: string | null,
    targetDate: string,
  ) => {
    const catItems = items.filter((i) => i.category_id === categoryId);
    const minSort = catItems.reduce((min, i) => Math.min(min, i.sort_order), 0);
    const newSort = minSort - 1;
    const tempId = crypto.randomUUID();
    const cat = categories.find((c) => c.id === categoryId) ?? null;

    const optimistic: DailyChecklistItem = {
      id: tempId,
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: newSort,
      created_at: new Date().toISOString(),
      category_id: categoryId,
      daily_checklist_categories: cat,
    };

    setItems((prev) => [optimistic, ...prev]);

    const insertPayload: Record<string, unknown> = {
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: newSort,
    };
    if (categoryId) insertPayload.category_id = categoryId;

    const { data, error } = await supabase
      .from("daily_checklist_items")
      .insert(insertPayload)
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id",
      )
      .single();

    if (error) {
      toast.error(error.message);
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === tempId
          ? { ...i, id: data.id, created_at: data.created_at }
          : i,
      ),
    );
  };

  const toggleItem = (item: DailyChecklistItem) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, is_checked: !row.is_checked } : row,
      ),
    );

    supabase
      .from("daily_checklist_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? { ...row, is_checked: item.is_checked }
                : row,
            ),
          );
        }
      });
  };

  const restoreItem = async (item: DailyChecklistItem) => {
    setItems((prev) =>
      prev.some((i) => i.id === item.id) ? prev : [...prev, item],
    );
    const { error } = await supabase.from("daily_checklist_items").insert({
      id: item.id,
      checklist_date: item.checklist_date,
      label: item.label,
      is_checked: item.is_checked,
      sort_order: item.sort_order,
      created_at: item.created_at,
      ...(item.category_id ? { category_id: item.category_id } : {}),
    });
    if (error) {
      toast.error(error.message);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  const deleteItem = (id: string) => {
    const removed = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));

    supabase
      .from("daily_checklist_items")
      .delete()
      .eq("id", id)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          if (removed) setItems((prev) => [...prev, removed]);
        } else if (removed) {
          toast("Item deleted", {
            duration: 8000,
            action: { label: "Undo", onClick: () => void restoreItem(removed) },
          });
        }
      });
  };

  const clearItems = (ids: string[]) => {
    const removed = itemsRef.current.filter((i) => ids.includes(i.id));
    if (removed.length === 0) return;
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));

    supabase
      .from("daily_checklist_items")
      .delete()
      .in("id", ids)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          setItems((prev) => [
            ...prev,
            ...removed.filter((r) => !prev.some((i) => i.id === r.id)),
          ]);
          return;
        }
        toast(
          `Cleared ${removed.length} item${removed.length === 1 ? "" : "s"}`,
          {
            duration: 8000,
            action: {
              label: "Undo",
              onClick: () => void restoreItems(removed),
            },
          },
        );
      });
  };

  const restoreItems = async (rows: DailyChecklistItem[]) => {
    setItems((prev) => [
      ...prev,
      ...rows.filter((r) => !prev.some((i) => i.id === r.id)),
    ]);
    const { error } = await supabase.from("daily_checklist_items").insert(
      rows.map((item) => ({
        id: item.id,
        checklist_date: item.checklist_date,
        label: item.label,
        is_checked: item.is_checked,
        sort_order: item.sort_order,
        created_at: item.created_at,
        category_id: item.category_id ?? null,
      })),
    );
    if (error) {
      toast.error(error.message);
      const ids = new Set(rows.map((r) => r.id));
      setItems((prev) => prev.filter((i) => !ids.has(i.id)));
    }
  };

  const checkItems = (ids: string[]) => {
    setItems((prev) =>
      prev.map((row) =>
        ids.includes(row.id) ? { ...row, is_checked: true } : row,
      ),
    );
    supabase
      .from("daily_checklist_items")
      .update({ is_checked: true })
      .in("id", ids)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          setItems((prev) =>
            prev.map((row) =>
              ids.includes(row.id) ? { ...row, is_checked: false } : row,
            ),
          );
        }
      });
  };

  const undoPopulate = async (rows: { id: string; label: string }[]) => {
    const current = itemsRef.current;
    const untouched = rows.filter((r) => {
      const item = current.find((i) => i.id === r.id);
      return item && item.label === r.label && !item.is_checked;
    });
    const kept =
      rows.filter((r) => current.some((i) => i.id === r.id)).length -
      untouched.length;
    setLastPopulate(null);
    if (untouched.length === 0) {
      toast.info("Nothing to undo — items were already changed or removed");
      return;
    }
    const ids = untouched.map((r) => r.id);
    const { error } = await supabase
      .from("daily_checklist_items")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    toast.success(
      `Removed ${ids.length} item${ids.length === 1 ? "" : "s"}${
        kept > 0 ? ` (${kept} kept — edited or ticked)` : ""
      }`,
    );
  };

  const populateDue = async (categoryId: string | null, targetDate: string) => {
    let groups: DueChecklistGroup[];
    try {
      const res = await fetch(`/api/checklist/due?date=${targetDate}`);
      if (!res.ok) throw new Error("Failed to load due collections");
      groups = ((await res.json()) as { groups: DueChecklistGroup[] }).groups;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to populate");
      return;
    }

    const already = new Set(
      itemsRef.current.flatMap((i) =>
        extractScheduleRefs(i.label).map((r) => r.id),
      ),
    );
    const labels = groups
      .map((g) => ({ ...g, items: g.items.filter((i) => !already.has(i.id)) }))
      .filter((g) => g.items.length > 0)
      .map(buildDueLabel);
    if (labels.length === 0) {
      toast.info(
        "Nothing new to add — everything due on this date is already listed",
      );
      return;
    }

    const minSort = itemsRef.current
      .filter((i) => i.category_id === categoryId)
      .reduce((min, i) => Math.min(min, i.sort_order), 0);
    const payload = labels.map((label, idx) => ({
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: minSort - labels.length + idx,
      ...(categoryId ? { category_id: categoryId } : {}),
    }));
    const { data, error } = await supabase
      .from("daily_checklist_items")
      .insert(payload)
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id",
      );
    if (error) {
      toast.error(error.message);
      return;
    }

    const cat = categories.find((c) => c.id === categoryId) ?? null;
    const created = ((data ?? []) as DailyChecklistItem[]).map((row) => ({
      ...row,
      daily_checklist_categories: cat,
    }));
    const rows = created.map((c) => ({ id: c.id, label: c.label }));
    setItems((prev) => [
      ...created,
      ...prev.filter((p) => !created.some((c) => c.id === p.id)),
    ]);
    setLastPopulate({ date: targetDate, categoryId, rows });
    toast.success(
      `Added ${created.length} borrower${created.length === 1 ? "" : "s"}`,
      {
        duration: 8000,
        action: { label: "Undo", onClick: () => void undoPopulate(rows) },
      },
    );
  };

  const dayTotals = useMemo(() => summarizeChecklist(items), [items]);
  const doneCount = items.filter((i) => i.is_checked).length;
  const collectedPct =
    dayTotals.expected > 0
      ? Math.min(100, (dayTotals.checkedOff / dayTotals.expected) * 100)
      : 0;

  const grouped = useMemo(() => {
    const map = new Map<string | null, DailyChecklistItem[]>();
    for (const item of items) {
      const key = item.category_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  const today = todayDateValue();
  const relativeDay = relativeDayLabel(date, today);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div
        className="sticky top-4 z-10 flex items-center gap-1 rounded-2xl border
          border-border bg-background/80 py-2 pr-2 pl-4 backdrop-blur-md"
      >
        <div className="relative min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold tracking-wide
              text-muted-foreground"
          >
            daily checklist
          </p>
          <button
            type="button"
            onClick={openDatePicker}
            className="flex max-w-full items-center gap-2 text-left"
            aria-label="Pick a date"
          >
            <h1
              className="truncate text-xl font-bold tracking-tight
                text-foreground sm:text-2xl"
            >
              {formatLongDate(date, today)}
            </h1>
            {relativeDay && (
              <span
                className="shrink-0 rounded-full bg-muted px-2 py-0.5
                  text-[11px] font-semibold text-muted-foreground"
              >
                {relativeDay}
              </span>
            )}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 size-px
              opacity-0"
          />
        </div>
        {date !== today && (
          <button
            type="button"
            onClick={() => setDate(today)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold
              text-foreground transition-colors duration-200 hover:bg-muted"
          >
            today
          </button>
        )}
        <button
          type="button"
          onClick={() => setDate((d) => shiftDateValue(d, -1))}
          className={ICON_BUTTON}
          aria-label="Previous day"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setDate((d) => shiftDateValue(d, 1))}
          className={ICON_BUTTON}
          aria-label="Next day"
        >
          <ChevronRight className="size-5" />
        </button>
        <Link
          href="/daily-checklist/categories"
          className={ICON_BUTTON}
          aria-label="Manage categories"
          title="Categories"
        >
          <Settings className="size-4" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-10 animate-pulse rounded-full bg-muted/70" />
                <div
                  className="ml-auto h-4 w-4 animate-pulse rounded-full
                    bg-muted/70"
                />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-8 animate-pulse rounded-xl bg-muted/60" />
                <div className="h-8 animate-pulse rounded-xl bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 && categories.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border
            border-border py-16 text-center"
        >
          <div
            className="flex size-12 items-center justify-center rounded-full
              bg-muted"
          >
            <Plus className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              No categories yet
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Create a category to start organizing your tasks
            </p>
          </div>
          <Link
            href="/daily-checklist/categories"
            className="mt-1 rounded-lg bg-foreground px-4 py-2 text-xs
              font-semibold text-background transition-opacity duration-200
              hover:opacity-80"
          >
            Create category
          </Link>
        </div>
      ) : (
        <>
          {dayTotals.collections > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4
              shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    left to collect
                  </p>
                  <p
                    className="text-2xl font-bold tracking-tight text-foreground
                      tabular-nums"
                  >
                    ₱{dayTotals.left.toLocaleString()}
                  </p>
                </div>
                <p
                  className="shrink-0 pb-1 text-xs font-medium
                    text-muted-foreground tabular-nums"
                >
                  {doneCount} of {items.length} done
                </p>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Collected"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(collectedPct)}
              >
                <div
                  className="h-full rounded-full bg-emerald-500
                    transition-[width] duration-500"
                  style={{ width: `${collectedPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                ₱{dayTotals.checkedOff.toLocaleString()} of ₱
                {dayTotals.expected.toLocaleString()} collected
              </p>
            </div>
          )}
          {categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              items={grouped.get(cat.id) ?? []}
              date={date}
              onAdd={addItem}
              onToggle={toggleItem}
              onDelete={deleteItem}
              onClear={clearItems}
              onEditLabel={editItemLabel}
              onPopulate={populateDue}
              onCheckMany={checkItems}
              onUndoPopulate={
                lastPopulate &&
                lastPopulate.date === date &&
                lastPopulate.categoryId === cat.id
                  ? () => void undoPopulate(lastPopulate.rows)
                  : undefined
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
