"use client";

import { useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import { Card } from "@/components/motion/card";
import { SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

type DashCardProps = Omit<ComponentProps<typeof Card>, "size" | "variant"> & {
  /** Position in a row of cards; staggers the entrance. */
  index?: number;
};

/**
 * The dashboard's card surface: beUI's Card with the app's own look, rising
 * into place the first time it scrolls into view. Padding comes from the
 * caller's className, since the cards here don't use the Card parts.
 */
export function DashCard({ index = 0, className, ...props }: DashCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Card
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ ...SPRING_PANEL, delay: Math.min(index, 6) * 0.05 }}
      className={cn("min-w-0 gap-0 rounded-xl bg-card py-0", className)}
      {...props}
    />
  );
}
