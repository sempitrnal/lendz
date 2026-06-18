"use client";

interface CategoryNavItem {
  label: string;
  color: string | null;
  pendingCount: number;
  paidCount: number;
}

interface CategoryScrollNavProps {
  categories: CategoryNavItem[];
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function CategoryScrollNav({
  categories,
}: CategoryScrollNavProps) {
  function scrollTo(label: string) {
    const id = slugify(label);
    const el = document.getElementById(`cat-${id}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:mb-6">
      {categories.map((cat) => (
        <button
          key={cat.label}
          type="button"
          onClick={() => scrollTo(cat.label)}
          className="dark:border-border dark:bg-card dark:text-foreground flex
            shrink-0 items-center gap-1.5 rounded-lg border border-slate-400
            bg-white px-3 py-2 text-xs font-bold text-slate-600 transition
            hover:bg-slate-50 dark:hover:bg-muted"
        >
          <span
            className="size-2 rounded-full border border-slate-900/25"
            style={{
              backgroundColor: cat.color ?? "#cbd5e1",
            }}
          />
          <span className="whitespace-nowrap">{cat.label}</span>
          <span
            className="text-[10px] font-semibold text-slate-400
              dark:text-muted-foreground"
          >
            {cat.pendingCount + cat.paidCount}
          </span>
        </button>
      ))}
    </div>
  );
}
