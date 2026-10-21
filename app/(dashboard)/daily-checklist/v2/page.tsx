import ChecklistScreen from "@/components/dashboard/checklist-v2/checklist-screen";

// The new mobile checklist, trialled here while `/daily-checklist` keeps the
// classic widget. The screen is a client component; this page stays a server
// component under the dashboard layout.
export default function DailyChecklistV2Page() {
  return <ChecklistScreen />;
}
