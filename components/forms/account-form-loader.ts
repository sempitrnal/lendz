"use client";

import dynamic from "next/dynamic";

/**
 * The account form is a big file, so it is fetched on its own rather than
 * with the page. This is the one copy of that split:
 *
 * - `loadAccountForm()` starts the fetch (safe to call any number of times).
 *   Call it early, and open a sheet only after it resolves, so the sheet
 *   never opens on an empty box.
 * - `AccountForm` is the form itself. It shows nothing while its code
 *   arrives, never a loading placeholder.
 */

let pending: Promise<typeof import("./account-form")> | null = null;

export function loadAccountForm() {
  pending ??= import("./account-form").catch((error) => {
    // Let the next call try again (a dropped connection, say).
    pending = null;
    throw error;
  });
  return pending;
}

export const AccountForm = dynamic(loadAccountForm, { loading: () => null });
