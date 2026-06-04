"use client";
import { RiDashboardFill } from "react-icons/ri";
import {
  MdAccountBalanceWallet,
  MdCategory,
  MdChecklist,
  MdDelete,
  MdLogout,
} from "react-icons/md";
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

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenu,
} from "./ui/dropdown-menu";
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
  { href: "/deleted", label: "trash" },
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

  useEffect(() => {
    DESKTOP_LINKS.forEach(({ href }) => router.prefetch(href));
  }, [router]);

  if (pathname === "/login") return null;

  function closeModal() {
    setIsLogoutModalOpen(false);
  }
  function openModal() {
    setIsLogoutModalOpen(true);
  }

  return (
    <header className="bg-background/80 dark:border-border/50 dark:bg-background/80 hidden border-b border-slate-200 backdrop-blur sm:sticky sm:top-0 sm:z-50 sm:flex sm:flex-col print:hidden">
      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onMouseEnter={() => router.prefetch("/")}
            onClick={() => {
              setPendingHref("/");
              startTransition(() => router.push("/"));
            }}
            className="dark:text-foreground dark:hover:text-muted-foreground text-lg font-black tracking-tight transition-colors hover:text-stone-600"
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
          <div className="dark:text-foreground hidden items-center gap-5 text-sm font-medium text-stone-900 sm:flex">
            {DESKTOP_LINKS.map(({ href, label }) => {
              const isLoading = isPending && pendingHref === href;
              return (
                <button
                  key={href}
                  type="button"
                  onMouseEnter={() => router.prefetch(href)}
                  onClick={() => {
                    setPendingHref(href);
                    startTransition(() => router.push(href));
                  }}
                  className={`dark:hover:text-muted-foreground transition-colors hover:text-stone-700 ${isLoading ? "opacity-60" : ""}`}
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
                className="dark:bg-primary dark:text-primary-foreground dark:hover:bg-muted-foreground cursor-pointer rounded-md border bg-stone-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-stone-600"
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
              className="dark:border-border dark:text-foreground dark:hover:bg-muted inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-lg text-stone-700 transition-colors hover:bg-slate-100 sm:hidden"
            >
              <GiHamburgerMenu />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-52 border-0 bg-transparent p-2 text-2xl font-bold shadow-none ring-0 outline-0"
          >
            <DropdownMenuItem
              asChild
              className="dark:border-border dark:bg-card mb-2 cursor-pointer border border-indigo-950 bg-white text-xl shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a]"
            >
              <Link href="/dashboard">
                {" "}
                <RiDashboardFill />
                dashboard
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              asChild
              className="dark:border-border dark:bg-card mb-2 cursor-pointer border border-indigo-950 bg-white text-xl shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a]"
            >
              <Link href="/borrowers">
                {" "}
                <FaUsers /> borrowers
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              asChild
              className="dark:border-border dark:bg-card mb-2 cursor-pointer border border-indigo-950 bg-white text-xl shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a]"
            >
              <Link href="/accounts">
                {" "}
                <MdAccountBalanceWallet /> accounts
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              asChild
              className="dark:border-border dark:bg-card mb-2 cursor-pointer border border-indigo-950 bg-white text-xl shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a]"
            >
              <Link href="/categories">
                {" "}
                <MdCategory /> categories
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              asChild
              className="dark:border-border dark:bg-card mb-2 cursor-pointer border border-indigo-950 bg-white text-xl shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a]"
            >
              <Link href="/daily-checklist">
                {" "}
                <MdChecklist /> daily checklist
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              asChild
              className="dark:border-border dark:bg-card mb-2 cursor-pointer border border-indigo-950 bg-white text-xl shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] dark:shadow-[2px_2px_0px_0px_#0f172a]"
            >
              <Link href="/deleted">
                {" "}
                <MdDelete /> trash
              </Link>
            </DropdownMenuItem>

            {isLoggedIn && (
              <DropdownMenuItem
                onClick={openModal}
                className="dark:border-border mb-2 cursor-pointer border border-indigo-950 bg-red-500 text-xl text-white shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] hover:bg-red-600 dark:shadow-[2px_2px_0px_0px_#0f172a]"
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

          <p className="text-muted-foreground text-center text-sm">
            Are you sure you want to logout?
          </p>

          <div className="mt-4 flex justify-center gap-2">
            <NeobrutButton
              onClick={() => {
                logoutAction();
                setIsLogoutModalOpen(false);
              }}
              variant="white"
            >
              yes
            </NeobrutButton>
            <NeobrutButton
              variant="red"
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
