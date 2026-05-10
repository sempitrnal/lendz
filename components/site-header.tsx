"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Modal from "./modal";
import { useEffect, useState } from "react";

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
    <header className="border-b border-slate-200">
      <nav className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Utangz
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
              href="/categories"
              className="transition-colors hover:text-stone-700"
            >
              categories
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
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-menu"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-stone-700 transition-colors hover:bg-slate-100 sm:hidden"
          >
            Menu
          </button>
        </div>

        {isMobileMenuOpen ? (
          <div
            id="mobile-nav-menu"
            className="absolute right-4  top-full z-20 mt-2 flex w-max items-center px-8 pt-5 pb-5 flex-col gap-5 rounded-md border border-slate-200 bg-white p-3  font-medium text-stone-900 shadow-lg sm:hidden"
          >
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
              href="/categories"
              className="transition-colors hover:text-stone-700"
            >
              categories
            </Link>
            {isLoggedIn ? (
              <form action={openModal}>
                <button
                  type="submit"
                  className="rounded-md border bg-stone-900 px-3 py-1.5 text-white transition-colors hover:bg-stone-600 cursor-pointer"
                >
                  logout
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </nav>
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={closeModal}
        closeOnEscape
        size="sm"
        title=""
        closeOnOverlayClick
      >
        <div className="flex flex-col gap-2 ">
          <p className="text-center mb-1">are you sure you want to logout?</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                logoutAction();
                closeModal();
              }}
              className="border-stone-700 rounded-md border px-4 py-1 cursor-pointer hover:bg-stone-100 transition duration-300"
            >
              yes
            </button>
            <button
              onClick={closeModal}
              className="rounded-md border border-stone-700 px-4 py-1 cursor-pointer text-white bg-red-500 hover:bg-red-400 transition duration-300"
            >
              no
            </button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
