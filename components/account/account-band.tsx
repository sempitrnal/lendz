"use client";

import Link from "next/link";
import { useRef } from "react";
import { Eye, EyeOff, Link2, MoreVertical, Share2, User } from "lucide-react";
import { toast } from "sonner";
import { cn, isDarkColor } from "@/lib/utils";
import { HIDDEN_AMOUNT, useHideAmounts } from "@/lib/hide-amounts";
import {
  formatAmount,
  releasedLabel,
  releaseDateLabel,
} from "@/lib/account-card/summary";
import { daysBetween, todayDateValue } from "@/lib/checklist/dates";
import {
  BAR_PX,
  STATS_PX,
  useCollapsingBand,
} from "@/components/borrower/borrower-band";
import ShareScheduleButton, {
  type ShareScheduleControl,
} from "@/components/share-schedule-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ShareProps = Omit<
  React.ComponentProps<typeof ShareScheduleButton>,
  "hideTrigger" | "controlRef" | "noDetails"
>;

export type AccountBandProps = {
  accountId: string;
  borrowerId: string;
  borrowerName: string;
  categories: { id?: string; name: string; color: string | null }[];
  /** "loan" or "cash advance". */
  kind: string;
  principal: number;
  /** "10% · bimonthly · 4mo" */
  terms: string;
  /** `YYYY-MM-DD`, or null when it has none. */
  releaseDate: string | null;
  left: number;
  collected: number;
  profit: number;
  pct: number;
  share: ShareProps;
};

/**
 * A menu row: soft grey when hovered or focused (the theme's accent is
 * amber). The item recolours everything inside it on focus, so the tiles and
 * hints hold their colours with `!`.
 */
const MENU_ROW =
  "gap-3 rounded-2xl px-2 py-2 focus:bg-muted focus:text-foreground not-data-[variant=destructive]:focus:**:text-inherit";

function MenuRow({
  Icon,
  title,
  hint,
  tint,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  tint: string;
}) {
  return (
    <>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl
          ${tint}`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block truncate text-[11px] !text-muted-foreground">
          {hint}
        </span>
      </span>
    </>
  );
}

const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;

async function copyPublicLink(accountId: string) {
  const url = `${window.location.origin}/accounts/${accountId}/view`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  toast.success("Public link copied");
}

/**
 * The account page's green band: a progress ring beside the principal and its
 * terms, then what's left, collected and the profit. It folds into a fixed
 * header under the top bar the way the borrower's band does (the fold is the
 * borrower band's, see `useCollapsingBand`); the folded header carries the
 * borrower, the kind of account and a row of figures. Share and the public
 * link live in the menu.
 */
export function AccountBand({
  accountId,
  borrowerId,
  borrowerName,
  categories,
  kind,
  principal,
  terms,
  releaseDate,
  left,
  collected,
  profit,
  pct,
  share,
}: AccountBandProps) {
  const head = useRef<HTMLDivElement>(null);
  const slab = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const headBg = useRef<HTMLDivElement>(null);
  const headShadow = useRef<HTMLDivElement>(null);
  const headStats = useRef<HTMLDivElement>(null);
  const shareControl = useRef<ShareScheduleControl>(null);
  useCollapsingBand({ head, slab, body, headBg, headShadow, headStats });
  const [hide, toggleHide] = useHideAmounts();

  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  const peso = (n: number) => `₱${formatAmount(Math.round(n))}`;
  const name = borrowerName.trim();

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account actions"
          className="flex size-8 shrink-0 items-center justify-center
            rounded-full bg-white/20 text-white transition-colors outline-none
            hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white/70
            print:hidden"
        >
          <MoreVertical className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-3xl p-1.5 shadow-xl"
      >
        {/* Whose account the actions are for. */}
        <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
          {/* In the borrower's category colour, as on the borrowers page. */}
          <span
            style={
              {
                "--cat": categories.find((c) => c.color)?.color ?? "#94a3b8",
              } as React.CSSProperties
            }
            className="flex size-9 shrink-0 items-center justify-center
              rounded-full bg-[color-mix(in_oklab,var(--cat)_22%,var(--card))]
              text-xs font-black
              text-[color-mix(in_oklab,var(--cat)_45%,var(--foreground))]
              uppercase ring-1 ring-black/5 ring-inset dark:ring-white/10"
            aria-hidden="true"
          >
            {name
              .split(/\s+/)
              .filter(Boolean)
              .map((w, i, all) => (i === 0 || i === all.length - 1 ? w[0] : ""))
              .join("")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black lowercase">{name}</p>
            <p
              className="truncate text-[11px] font-semibold
                text-muted-foreground"
            >
              {kind} · {mask(peso(principal))}
            </p>
          </div>
        </div>
        <div className="space-y-0.5">
          <DropdownMenuItem
            onClick={() => shareControl.current?.capture()}
            className={MENU_ROW}
          >
            <MenuRow
              Icon={Share2}
              title="Share schedule"
              hint="Send an image of every payment"
              tint="bg-emerald-500/15 !text-emerald-600 dark:!text-emerald-300"
            />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void copyPublicLink(accountId)}
            className={MENU_ROW}
          >
            <MenuRow
              Icon={Link2}
              title="Copy public link"
              hint="Anyone with it can view the schedule"
              tint="bg-sky-500/15 !text-sky-600 dark:!text-sky-300"
            />
          </DropdownMenuItem>
          {borrowerId && (
            <DropdownMenuItem asChild className={MENU_ROW}>
              <Link href={`/borrowers/${borrowerId}`}>
                <MenuRow
                  Icon={User}
                  title="View borrower"
                  hint="Their accounts, notes and history"
                  tint="bg-violet-500/15 !text-violet-600 dark:!text-violet-300"
                />
              </Link>
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const chips = (
    <div className="mt-1 flex flex-wrap gap-1.5">
      <span
        className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px]
          font-semibold text-white"
      >
        {kind} · {mask(peso(principal))}
      </span>
      {categories.map((c) => (
        <span
          key={c.id ?? c.name}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            c.color
              ? isDarkColor(c.color)
                ? "text-white"
                : "text-slate-800"
              : "bg-white/20 text-white",
          )}
          style={c.color ? { backgroundColor: c.color } : undefined}
        >
          {c.name}
        </span>
      ))}
    </div>
  );

  const nameLink = (className: string) => (
    <Link
      href={borrowerId ? `/borrowers/${borrowerId}` : "#"}
      className={className}
    >
      {name}
    </Link>
  );

  return (
    <>
      <div className="sticky z-30 -mx-4 h-0 sm:hidden" style={{ top: BAR_PX }}>
        <div
          ref={head}
          data-settle
          className="absolute inset-x-0 top-0 px-4 pt-1 pb-2.5 text-white"
        >
          <div
            ref={headBg}
            aria-hidden="true"
            className="absolute inset-x-0 top-0 rounded-b-3xl bg-(--page-1)
              opacity-0"
            style={{ bottom: -STATS_PX }}
          />
          <div
            ref={headShadow}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0
              rounded-b-3xl opacity-0 shadow-[0_8px_14px_-6px_rgba(0,0,0,0.35)]"
            style={{ bottom: -STATS_PX }}
          />
          <div
            ref={headStats}
            className="pointer-events-none absolute inset-x-4 top-full grid
              grid-cols-4 gap-2 opacity-0"
            style={{ height: STATS_PX }}
          >
            {[
              ["Left", mask(peso(left))],
              ["Collected", mask(peso(collected))],
              ["Profit", mask(peso(Math.max(0, profit)))],
              ["Done", `${pct}%`],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="truncate text-[10px] font-semibold opacity-80">
                  {label}
                </p>
                <p className="truncate text-[13px] font-black tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              {/* Scaled by the band's fold; narrowed by the same factor so the
                  bigger name still fits (see BorrowerBand). */}
              <div className="min-w-0 flex-1">
                {nameLink(
                  `block origin-left [transform:scale(var(--name-scale,1.3))]
                  [width:calc(100%/var(--name-scale,1.3))] truncate text-sm
                  font-black will-change-transform lowercase`,
                )}
              </div>
              {menu}
            </div>
            {chips}
          </div>
        </div>
      </div>
      <div
        ref={slab}
        data-settle-group="band"
        className="sticky z-0 -mx-4 overflow-hidden px-4 text-white sm:relative
          sm:mx-0 sm:overflow-visible sm:px-5 sm:pt-5"
        style={{ top: BAR_PX - 300 }}
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="absolute inset-0 rounded-b-3xl
            bg-[linear-gradient(to_bottom,var(--page-1),var(--page-2))]
            sm:rounded-3xl"
        />
        <div
          aria-hidden="true"
          data-band-flat
          className="absolute inset-0 rounded-b-3xl bg-(--page-1) opacity-0
            sm:hidden"
        />
        <div
          ref={body}
          className="relative origin-top pb-14 will-change-transform sm:pb-20"
        >
          {/* Wider screens have no top bar to dock into: the name sits here. */}
          <div className="mb-5 hidden sm:block">
            <div className="flex items-center gap-2">
              {nameLink("min-w-0 flex-1 truncate text-lg font-black lowercase")}
              {menu}
            </div>
            {chips}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative size-[84px] shrink-0">
              <svg
                viewBox="0 0 84 84"
                className="-rotate-90"
                role="img"
                aria-label={`${pct}% collected`}
              >
                <circle
                  cx="42"
                  cy="42"
                  r={RING_R}
                  strokeWidth="8"
                  className="fill-none stroke-white/25"
                />
                <circle
                  cx="42"
                  cy="42"
                  r={RING_R}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C - (pct / 100) * RING_C}
                  className="fill-none stroke-white
                    transition-[stroke-dashoffset] duration-700"
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center
                  text-lg font-black tabular-nums"
              >
                {pct}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={toggleHide}
                aria-label={hide ? "Show amounts" : "Hide amounts"}
                className="flex items-center gap-2 text-xs font-semibold
                  opacity-80"
              >
                Principal
                {hide ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
              <p
                className="truncate text-3xl font-black tracking-tight
                  tabular-nums"
              >
                {mask(peso(principal))}
              </p>
              <p className="truncate text-xs font-semibold opacity-80">
                {terms}
              </p>
              {releaseDate && (
                <p className="mt-0.5 truncate text-xs font-bold">
                  {releasedLabel(
                    daysBetween(releaseDate.slice(0, 10), todayDateValue()),
                  )}
                  <span className="font-semibold opacity-80">
                    {" · "}
                    {releaseDateLabel(
                      releaseDate.slice(0, 10),
                      new Date().getFullYear(),
                    )}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["left", left],
              ["collected", collected],
              ["profit", Math.max(0, profit)],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="min-w-0 rounded-2xl bg-white/15 px-2 py-2"
              >
                <p className="text-[11px] font-semibold opacity-80">{label}</p>
                <p className="truncate text-sm font-black tabular-nums">
                  {mask(peso(value as number))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ShareScheduleButton {...share} hideTrigger controlRef={shareControl} />
    </>
  );
}
