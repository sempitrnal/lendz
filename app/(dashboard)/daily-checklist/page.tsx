import DailyNotesWidget from "@/components/dashboard/daily-notes-widget";
import MorningNotificationToggle from "@/components/morning-notification-toggle";

export default function DailyChecklistPage() {
  return (
    <main className="mx-auto max-w-7xl py-6">
      <h1 className="mb-4 text-2xl font-black lowercase text-slate-900 dark:text-foreground">
        daily checklist
      </h1>
      <div className="max-w-xl space-y-4">
        <MorningNotificationToggle />
        <DailyNotesWidget />
      </div>
    </main>
  );
}
