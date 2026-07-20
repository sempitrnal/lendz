import DailyNotesWidget from "@/components/dashboard/daily-notes-widget";

export default function DailyChecklistPage() {
  return (
    <main className="mx-auto max-w-7xl py-10 md:max-w-full pb-16">
      <div className="mb-8 space-y-1 px-6">
        <h1
          className="text-3xl font-bold tracking-tight text-slate-800
            dark:text-foreground"
        >
          daily checklist
        </h1>
        <p className="text-sm text-slate-400 dark:text-muted-foreground">
          Stay on top of your day
        </p>
      </div>
      <div className="space-y-6">
        <DailyNotesWidget />
      </div>
    </main>
  );
}
