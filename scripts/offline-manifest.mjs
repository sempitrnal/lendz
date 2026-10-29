#!/usr/bin/env node
/**
 * Runs after `next build`. Writes `public/offline-manifest.json` (served at
 * /offline-manifest.json) for the offline sync. It lives in `public/` because
 * Vercel does not publish files added to `.next/static` after the build, but
 * does publish `public/`:
 *
 * - `buildId`: a new one means every saved page needs downloading again.
 * - `assets`: every static file of this build, so the worker can fetch the
 *   new ones ahead of time (pages offline need their chunks) and drop the
 *   ones no longer used.
 * - `refresh`: which saved pages a new build re-downloads: "all", "borrowers"
 *   (the checklist and the borrower pages) or "checklist" for a deploy that
 *   only changed the checklist (the other pages and the old build's files are
 *   kept until the next "all" deploy).
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const NEXT = ".next";
const OUT = join("public", "offline-manifest.json");

const buildId = readFileSync(join(NEXT, "BUILD_ID"), "utf8").trim();

// "borrowers" saves the checklist and the borrower pages again (not the
// account pages). Build with OFFLINE_REFRESH=all for a deploy that changes the
// account pages or anything they share, or "checklist" for one that changes
// nothing but the checklist.
const REFRESH = process.env.OFFLINE_REFRESH ?? "borrowers";

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const staticDir = join(NEXT, "static");
const assets = listFiles(staticDir)
  .map((file) => `/_next/${relative(NEXT, file).split("\\").join("/")}`)
  .filter(
    (url) => !url.endsWith("/offline-manifest.json") && !url.endsWith(".map"),
  )
  .sort();

writeFileSync(OUT, JSON.stringify({ buildId, assets, refresh: REFRESH }));
console.log(`offline manifest: ${assets.length} assets, refresh ${REFRESH}`);
