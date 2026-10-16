/**
 * Plain names for queued writes, so the sync menu can say what is waiting
 * ("Tick “bo test 12345 ca”", "New account · ₱5,000") instead of a count.
 */

export type OutboxRequest = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  /** Raw body as the service worker stored it. */
  body?: ArrayBuffer | string | null;
};

/** Looks up a checklist item's label by id (from the local snapshot). */
export type LabelLookup = (id: string) => string | undefined;

const peso = (n: unknown) =>
  typeof n === "number" || (typeof n === "string" && n !== "")
    ? `₱${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : null;

const quote = (s: string) => `“${s.length > 28 ? `${s.slice(0, 27)}…` : s}”`;

function parseBody(body: OutboxRequest["body"]): unknown {
  if (body == null) return null;
  try {
    const text =
      typeof body === "string" ? body : new TextDecoder().decode(body);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** `id=eq.<uuid>` from a PostgREST query string. */
function eqId(url: URL): string | undefined {
  return url.searchParams.get("id")?.replace(/^eq\./, "");
}

function humanize(name: string) {
  const words = name.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function describeOutboxRequest(
  req: OutboxRequest,
  lookupLabel: LabelLookup = () => undefined,
): string {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return "Saved change";
  }
  const method = req.method.toUpperCase();
  const body = parseBody(req.body);
  const row = (Array.isArray(body) ? body[0] : body) as Record<
    string,
    unknown
  > | null;
  const count = Array.isArray(body) ? body.length : 1;

  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)/);
  if (rpc) return humanize(rpc[1]);

  const table = url.pathname.match(/\/rest\/v1\/([^/]+)/)?.[1];
  if (!table) {
    // Server actions post to the page they were called from.
    const isAction = Object.keys(req.headers ?? {}).some(
      (h) => h.toLowerCase() === "next-action",
    );
    return isAction ? "Background update" : "Saved change";
  }

  const id = eqId(url);
  const itemName = () => {
    const label = id ? lookupLabel(id) : undefined;
    return label ? quote(label) : "checklist item";
  };

  switch (table) {
    case "daily_checklist_items":
      if (method === "POST")
        return row?.label
          ? `Add ${quote(String(row.label))} to checklist`
          : "Add checklist item";
      if (method === "DELETE") return `Remove ${itemName()}`;
      if (row && "is_checked" in row)
        return `${row.is_checked ? "Tick" : "Untick"} ${itemName()}`;
      if (row?.label) return `Rename to ${quote(String(row.label))}`;
      return `Update ${itemName()}`;

    case "accounts": {
      if (method === "POST") {
        const amount = peso(row?.principal_amount);
        return amount ? `New account · ${amount}` : "New account";
      }
      if (method === "DELETE") return "Delete account";
      if (row?.status === "active") return "Activate account";
      return "Update account";
    }

    case "payment_schedules":
      if (method === "POST")
        return count > 1
          ? `Add ${count} payment schedules`
          : "Add payment schedule";
      if (method === "DELETE") return "Remove payment schedule";
      if (row?.status === "paid") return "Mark schedule paid";
      if (row?.status === "pending") return "Mark schedule unpaid";
      return "Update payment schedule";

    case "schedule_payments": {
      if (method === "DELETE") return "Undo payment";
      const amount = peso(row?.amount);
      return amount ? `Record ${amount} payment` : "Record payment";
    }

    case "borrowers":
      if (method === "POST")
        return row?.name
          ? `Add borrower ${quote(String(row.name))}`
          : "Add borrower";
      if (method === "DELETE") return "Delete borrower";
      return "Update borrower";

    case "calendar_events":
      if (method === "POST")
        return row?.title ? String(row.title) : "Add calendar event";
      if (method === "DELETE") return "Remove calendar event";
      return "Update calendar event";
  }

  const verb =
    method === "POST" ? "Add" : method === "DELETE" ? "Remove" : "Update";
  return `${verb} ${humanize(table).toLowerCase()}`;
}

export type QueuedTask = {
  label: string;
  /** Consecutive identical changes are shown once with a count. */
  count: number;
  failed: boolean;
};

/** Names each entry and folds runs of the same change into one line. */
export function summarizeOutbox(
  entries: (OutboxRequest & { failed?: boolean })[],
  lookupLabel?: LabelLookup,
): QueuedTask[] {
  const tasks: QueuedTask[] = [];
  for (const entry of entries) {
    const label = describeOutboxRequest(entry, lookupLabel);
    const failed = Boolean(entry.failed);
    const last = tasks.at(-1);
    if (last && last.label === label && last.failed === failed) last.count++;
    else tasks.push({ label, count: 1, failed });
  }
  return tasks;
}
