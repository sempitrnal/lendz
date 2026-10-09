"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import { badgeClassFor } from "@/components/dashboard/checklist/dom";

export function LinkedLabel({
  label,
  checked,
  borrowers,
}: {
  label: string;
  checked: boolean;
  borrowers: BorrowerSearchItem[];
}) {
  const names = useMemo(() => {
    return new Map(borrowers.map((b) => [`${b.first_name} ${b.last_name}`, b]));
  }, [borrowers]);

  const amountPattern = /(?:₱\s*)?\b(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\b/;

  const isAmountBlock = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return trimmed.split("\n").every((line) => amountPattern.test(line.trim()));
  };

  const strike = (text: string, key: string, preserveWs = false) => {
    if (!text) return null;
    if (isAmountBlock(text)) {
      if (!preserveWs) {
        return (
          <span key={key} className="inline-block w-full pl-2 pt-2">
            <span className={checked ? "line-through" : ""}>{text.trim()}</span>
          </span>
        );
      }
      const leading = text.match(/^\s*/)?.[0] ?? "";
      const trailing = text.match(/\s*$/)?.[0] ?? "";
      return (
        <span key={key}>
          {leading}
          <span className="inline-block pl-2 pt-2">
            <span className={checked ? "line-through" : ""}>{text.trim()}</span>
          </span>
          {trailing}
        </span>
      );
    }
    return (
      <span key={key} className={checked ? "line-through" : ""}>
        {text}
      </span>
    );
  };

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  let prevBadge = false;
  while ((match = regex.exec(label)) !== null) {
    const isBadge = match[2].startsWith("#badge:");
    if (match.index > lastIndex) {
      parts.push(
        strike(
          label.slice(lastIndex, match.index),
          `md-${lastIndex}`,
          prevBadge || isBadge,
        ),
      );
    }
    parts.push(
      <MentionPill
        key={match.index}
        name={match[1]}
        href={match[2]}
        checked={checked}
      />,
    );
    prevBadge = isBadge;
    lastIndex = regex.lastIndex;
  }
  const tail = label.slice(lastIndex);
  if (tail) {
    let offset = 0;
    names.forEach((borrower, name) => {
      const idx = tail.indexOf(name, offset);
      if (idx !== -1) {
        if (idx > offset) {
          parts.push(
            strike(
              tail.slice(offset, idx),
              `tail-${offset}`,
              prevBadge && offset === 0,
            ),
          );
        }
        parts.push(
          <MentionPill
            key={`${borrower.id}-${idx}`}
            name={name}
            href={`/borrowers/${borrower.id}`}
            checked={checked}
          />,
        );
        offset = idx + name.length;
      }
    });
    if (offset < tail.length) {
      parts.push(
        strike(tail.slice(offset), "tail-end", prevBadge && offset === 0),
      );
    }
  }
  return <>{parts}</>;
}

export function MentionPill({
  name,
  href,
  checked,
}: {
  name: string;
  href: string;
  checked: boolean;
}) {
  const badgeClass = badgeClassFor(href);
  if (badgeClass) {
    return (
      <span
        className={`${badgeClass} ${checked ? "opacity-50 line-through" : ""}`}
      >
        {name}
      </span>
    );
  }
  return (
    <Link
      href={href}
      prefetch
      onClick={(e) => e.stopPropagation()}
      className={`inline-block lowercase rounded-md border px-2 pl-2.5 py-1
        text-sm font-semibold leading-none transition-opacity hover:opacity-70
        ${
          checked
            ? `border-slate-200 text-slate-400 dark:border-muted-foreground/30
              dark:text-muted-foreground/60`
            : `border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-800
              dark:bg-sky-900/20 dark:text-sky-300`
        }`}
    >
      {name}
    </Link>
  );
}
