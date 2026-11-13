"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./theme-toggle";
import HeaderSearch from "./header-search";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  usePageOwnsMobileHeader,
  useWalletDashboard,
} from "./use-wallet-dashboard";

type SiteHeaderProps = {
  isLoggedIn: boolean;
  logoutAction: () => Promise<void>;
};

export default function SiteHeader({
  isLoggedIn,
  logoutAction,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const walletDashboard = useWalletDashboard();
  // On the pages with a green band the header is the band's own green, as the
  // phone's top bar is.
  const green = usePageOwnsMobileHeader();

  if (pathname === "/login") return null;

  function openModal() {
    setIsLogoutModalOpen(true);
  }

  return (
    <header
      className={cn(
        `bg-background dark:border-border/50 dark:bg-background hidden border-b
        border-slate-200 transition-colors duration-200 sm:sticky sm:top-0
        sm:z-50 sm:flex sm:flex-col print:hidden md:ml-(--sidebar-width)`,
        green &&
          `border-transparent bg-(--page-1) text-onpage dark:border-transparent
          dark:bg-(--page-1)`,
      )}
    >
      <nav
        className="relative mx-auto flex w-full max-w-7xl md:max-w-full
          items-center justify-between px-4 py-[14.5px] sm:px-6"
      >
        {isLoggedIn && !walletDashboard && (
          <div className="flex flex-1 items-center gap-5">
            <HeaderSearch onColor={green} onFocusChange={setSearchFocused} />
          </div>
        )}
        {/* The dashboard's band carries its own search on a small tablet; from
            a tablet up the header has it, like every other page. */}
        {isLoggedIn && walletDashboard && (
          <div className="hidden flex-1 items-center gap-5 md:flex">
            <HeaderSearch onColor onFocusChange={setSearchFocused} />
          </div>
        )}
        {walletDashboard && <div className="flex-1 md:hidden" />}
        <div
          className={`flex items-center gap-3 overflow-hidden transition-all
            duration-200 ease-in-out ${
              searchFocused ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
            }`}
        >
          <ThemeToggle onColor={green} />
          {isLoggedIn && green && (
            <Link
              href="/upcoming"
              aria-label="Overdue"
              className="shrink-0 text-onpage"
            >
              <Bell className="size-5" aria-hidden="true" />
            </Link>
          )}
          {isLoggedIn && (
            <form action={openModal} className="hidden sm:block">
              <button
                type="submit"
                className={cn(
                  `dark:bg-primary dark:text-primary-foreground
                  dark:hover:bg-muted-foreground cursor-pointer rounded-md
                  border bg-stone-900 px-3 py-1.5 text-sm text-white
                  transition-colors hover:bg-stone-600`,
                  green &&
                    `border-transparent bg-onpage/20 text-onpage
                    hover:bg-onpage/30 dark:border-transparent dark:bg-onpage/20
                    dark:text-onpage dark:hover:bg-onpage/30`,
                )}
              >
                logout
              </button>
            </form>
          )}
        </div>
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
            <Button
              onClick={() => {
                logoutAction();
                setIsLogoutModalOpen(false);
              }}
            >
              Yes
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsLogoutModalOpen(false)}
            >
              No
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
