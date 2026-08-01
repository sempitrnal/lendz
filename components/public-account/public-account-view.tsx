import { PaymentSchedules } from "@/components/components-2/dashboard/payment-schedules";
import PublicAccountHero from "./public-account-hero";
import PublicAccountNextDue from "./public-account-next-due";
import type { PublicAccountViewModel } from "@/lib/public-account";

type Props = {
  view: PublicAccountViewModel;
};

export default function PublicAccountView({ view }: Props) {
  return (
    <div className="mx-auto w-full space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PublicAccountHero view={view} />

      {view.nextDue && (
        <PublicAccountNextDue
          amount={view.nextDue.amount}
          dueDate={view.nextDue.dueDate}
        />
      )}

      <PaymentSchedules
        title="Payment Schedule"
        nextDueDate={view.nextDue?.dueDate ?? null}
        nextDueAmount={view.nextDue?.remaining}
        progress={view.progressPct}
        progressLabel="Payment progress"
        nextNumber={view.nextNumber}
        schedules={view.scheduleItems}
        readOnly
      />
    </div>
  );
}
