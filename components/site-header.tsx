"use client";
import { RiDashboardFill } from "react-icons/ri";
import { MdAccountBalanceWallet, MdCategory, MdChecklist, MdLogout } from "react-icons/md";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GiHamburgerMenu } from "react-icons/gi";
import { Loader2 } from "lucide-react";
import NeobrutButton from "./neobrut-button";
import ThemeToggle from "./theme-toggle";

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenu } from "./ui/dropdown-menu";
import { FaUsers } from "react-icons/fa6";

type SiteHeaderProps = {
  isLoggedIn: boolean;
  logoutAction: () => Promise<void>;
};

const DESKTOP_LINKS = [
  { href: "/dashboard", label: "dashboard" },
  { href: "/borrowers", label: "borrowers" },
  { href: "/accounts", label: "accounts" },
  { href: "/calendar", label: "calendar" },
  { href: "/categories", label: "categories" },
  { href: "/daily-checklist", label: "daily checklist" },
];

export default function SiteHeader({
  isLoggedIn,
  logoutAction,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (pathname === "/login") return null;

  function closeModal() {
    setIsLogoutModalOpen(false);
  }
  function openModal() {
    setIsLogoutModalOpen(true);
  }

  return (
    <header className="hidden sm:sticky sm:top-0 sm:z-50 sm:flex sm:flex-col border-b border-slate-200 bg-white/80 backdrop-blur dark:border-border/50 dark:bg-background/80 print:hidden">
      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              setPendingHref("/");
              startTransition(() => router.push("/"));
            }}
            className="text-lg font-black tracking-tight transition-colors hover:text-stone-600 dark:text-foreground dark:hover:text-muted-foreground"
          >
            {isPending && pendingHref === "/" ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-4 animate-spin" />
                *utangz
              </span>
            ) : (
              "*utangz"
            )}
          </button>
          <div className="hidden items-center gap-5 text-sm font-medium text-stone-900 dark:text-foreground sm:flex">
            {DESKTOP_LINKS.map(({ href, label }) => {
              const isLoading = isPending && pendingHref === href;
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => {
                    setPendingHref(href);
                    startTransition(() => router.push(href));
                  }}
                  className={`transition-colors hover:text-stone-700 dark:hover:text-muted-foreground ${isLoading ? "opacity-60" : ""}`}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" />
                      {label}
                    </span>
                  ) : (
                    label
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isLoggedIn && (
            <form action={openModal} className="hidden sm:block">
              <button
                type="submit"
                className="rounded-md border bg-stone-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-stone-600 cursor-pointer dark:bg-primary dark:text-primary-foreground dark:hover:bg-muted-foreground"
              >
                logout
              </button>
            </form>
          )}

        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-lg text-stone-700 transition-colors hover:bg-slate-100 dark:border-border dark:text-foreground dark:hover:bg-muted sm:hidden"
            >
              <GiHamburgerMenu />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52 text-2xl font-bold p-2 bg-transparent outline-0 border-0 ring-0 shadow-none">
            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 dark:border-border shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a] bg-white dark:bg-card">
              <Link href="/dashboard"> <RiDashboardFill />dashboard</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 dark:border-border shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a] bg-white dark:bg-card">
              <Link href="/borrowers"> <FaUsers /> borrowers</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 dark:border-border shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a] bg-white dark:bg-card">
              <Link href="/accounts"> <MdAccountBalanceWallet /> accounts</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 dark:border-border shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a] bg-white dark:bg-card">
              <Link href="/categories"> <MdCategory /> categories</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 dark:border-border shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a] bg-white dark:bg-card">
              <Link href="/daily-checklist"> <MdChecklist /> daily checklist</Link>
            </DropdownMenuItem>

            {isLoggedIn && (
              <DropdownMenuItem
                onClick={openModal}
                className="text-white bg-red-500 text-xl mb-2 border border-indigo-950 dark:border-border shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a] hover:bg-red-600 cursor-pointer"
              >
                <MdLogout /> logout
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <Dialog open={isLogoutModalOpen} onOpenChange={setIsLogoutModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">
              Logout confirmation
            </DialogTitle>
          </DialogHeader>

          <p className="text-center text-sm text-muted-foreground">
            Are you sure you want to logout?
          </p>

          <div className="mt-4 flex justify-center gap-2">
            <NeobrutButton onClick={() => {
              logoutAction();
              setIsLogoutModalOpen(false);
            }} variant="white">
              yes
            </NeobrutButton>
            <NeobrutButton variant="red"
              onClick={() => setIsLogoutModalOpen(false)}
            >
              no
            </NeobrutButton>


          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
