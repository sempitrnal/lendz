"use client";
import { RiDashboardFill } from "react-icons/ri";
import { MdAccountBalanceWallet, MdCategory, MdChecklist, MdLogout } from "react-icons/md";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GiHamburgerMenu } from "react-icons/gi";
import NeobrutButton from "./neobrut-button";

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenu } from "./ui/dropdown-menu";
import { FaUsers } from "react-icons/fa6";
type SiteHeaderProps = {
  isLoggedIn: boolean;
  logoutAction: () => Promise<void>;
};

export default function SiteHeader({
  isLoggedIn,
  logoutAction,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur print:hidden">
      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-lg font-black tracking-tight">
            *utangz
          </Link>
          <div className="hidden items-center gap-5 text-sm font-medium text-stone-900 sm:flex">
            <Link
              href="/dashboard"
              className="transition-colors hover:text-stone-700"
            >
              dashboard
            </Link>
            <Link
              href="/borrowers"
              className="transition-colors hover:text-stone-700"
            >
              borrowers
            </Link>
            <Link
              href="/accounts"
              className="transition-colors hover:text-stone-700"
            >
              accounts
            </Link>
            <Link
              href="/categories"
              className="transition-colors hover:text-stone-700"
            >
              categories
            </Link>
            <Link
              href="/daily-checklist"
              className="transition-colors hover:text-stone-700"
            >
              daily checklist
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <form action={openModal} className="hidden sm:block">
              <button
                type="submit"
                className="rounded-md border bg-stone-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-stone-600 cursor-pointer"
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
              className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-lg text-stone-700 transition-colors hover:bg-slate-100 sm:hidden"
            >
              <GiHamburgerMenu />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52 text-2xl font-bold p-2 bg-transparent outline-0 border-0 ring-0 shadow-none">
            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] bg-white">
              <Link href="/dashboard"> <RiDashboardFill />dashboard</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2  border border-indigo-950 shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] bg-white">
              <Link href="/borrowers"> <FaUsers /> borrowers</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] bg-white">
              <Link href="/accounts"> <MdAccountBalanceWallet /> accounts</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] bg-white">
              <Link href="/categories"> <MdCategory /> categories</Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild className="text-xl cursor-pointer mb-2 border border-indigo-950 shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] bg-white ">
              <Link href="/daily-checklist"> <MdChecklist /> daily checklist</Link>
            </DropdownMenuItem>

            {isLoggedIn && (
              <DropdownMenuItem
                onClick={openModal}
                className="text-white bg-red-500  text-xl mb-2 border border-indigo-950 shadow-[2px_2px_0px_0px_rgba(59,72,107,1)] hover:bg-red-600  cursor-pointer"
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
