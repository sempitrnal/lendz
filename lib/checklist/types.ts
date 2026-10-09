export type ChecklistCategory = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type DailyChecklistItem = {
  id: string;
  checklist_date: string;
  label: string;
  is_checked: boolean;
  sort_order: number;
  created_at: string;
  category_id: string | null;
  daily_checklist_categories: ChecklistCategory | null;
};

export type DueChecklistItem = {
  id: string;
  due_date: string;
  amount: number;
  type: "loan" | "cash_advance";
};

export type DueChecklistGroup = {
  borrower_id: string;
  name: string;
  items: DueChecklistItem[];
};
