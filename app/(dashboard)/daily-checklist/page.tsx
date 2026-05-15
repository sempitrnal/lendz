import DailyNotesWidget from "@/components/dashboard/daily-notes-widget";

export default function DailyChecklistPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-black lowercase text-slate-900">
        daily checklist
      </h1>
      <div className="max-w-xl">
        <DailyNotesWidget />
      </div>
    </main>
  );
}
