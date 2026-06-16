"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import NeobrutButton from "./neobrut-button";
import ThemeToggle from "./theme-toggle";
import HeaderSearch from "./header-search";

type SiteHeaderProps = {
  isLoggedIn: boolean;
  logoutAction: () => Promise<void>;
};

export default function SiteHeader({
  isLoggedIn,
  logoutAction,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  if (pathname === "/login") return null;

  function closeModal() {
    setIsLogoutModalOpen(false);
  }
  function openModal() {
    setIsLogoutModalOpen(true);
  }

  return (
    <header
      className="bg-background/80 dark:border-border/50 dark:bg-background/80
        hidden border-b border-slate-200 backdrop-blur sm:sticky sm:top-0
        sm:z-50 sm:flex sm:flex-col print:hidden md:ml-[var(--sidebar-width)]"
    >
      <nav
        className="relative mx-auto flex w-full max-w-7xl items-center
          justify-between px-4 py-[14.5px] sm:px-6"
      >
        <div className="flex flex-1 items-center gap-5">
          <HeaderSearch />
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isLoggedIn && (
            <form action={openModal} className="hidden sm:block">
              <button
                type="submit"
                className="dark:bg-primary dark:text-primary-foreground
                  dark:hover:bg-muted-foreground cursor-pointer rounded-md
                  border bg-stone-900 px-3 py-1.5 text-sm text-white
                  transition-colors hover:bg-stone-600"
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
