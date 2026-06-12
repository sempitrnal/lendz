"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "@/lib/query-client";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
