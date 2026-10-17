#!/usr/bin/env node
/**
 * Runs after `next build`. Writes `.next/static/offline-manifest.json`
 * (served at /_next/static/offline-manifest.json) so the offline sync can
 * re-download only what a deploy changed:
 *
 * - `routes`: a fingerprint per app route, hashed from the files that route
 *   actually runs (its server entry, the server chunks it loads, and the
 *   browser chunks its client components use). Unchanged fingerprint means
 *   the pages cached for that route still match the new build.
 * - `assets`: every static file of this build, so the worker can fetch the
 *   new ones ahead of time (pages offline need their chunks) and drop the
 *   ones no longer used.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

const NEXT = ".next";
const OUT = join(NEXT, "static", "offline-manifest.json");

const read = (p) => readFileSync(p);
const buildId = readFileSync(join(NEXT, "BUILD_ID"), "utf8").trim();
const routesManifest = JSON.parse(
  readFileSync(join(NEXT, "app-path-routes-manifest.json"), "utf8"),
);

// The build id shows up in some outputs; strip it so a rebuild of the same
// code hashes the same.
const normalize = (buf) => buf.toString("utf8").split(buildId).join("");

// Every page's HTML loads the app's startup scripts, which no route lists, so
// they go into every fingerprint: if they change, every page is refreshed
// (otherwise a kept page would point at scripts the new version dropped).
const buildManifest = JSON.parse(
  readFileSync(join(NEXT, "build-manifest.json"), "utf8"),
);
const sharedHash = createHash("sha1");
for (const file of [
  ...(buildManifest.rootMainFiles ?? []),
  ...(buildManifest.polyfillFiles ?? []),
]) {
  sharedHash.update(file);
  const full = join(NEXT, file);
  if (existsSync(full)) sharedHash.update(normalize(read(full)));
}
const shared = sharedHash.digest("hex");

function routeFingerprint(entry) {
  const dir = join(NEXT, "server", "app", entry.replace(/\/page$/, ""));
  const pageJs = join(dir, "page.js");
  const clientManifest = join(dir, "page_client-reference-manifest.js");
  if (!existsSync(pageJs)) return null;

  const hash = createHash("sha1");
  hash.update(shared);
  const pageSource = normalize(read(pageJs));
  hash.update(pageSource);

  // Server chunks the entry loads: R.c("server/chunks/…")
  const serverChunks = [...pageSource.matchAll(/R\.c\("([^"]+)"\)/g)]
    .map((m) => m[1])
    .sort();
  for (const chunk of serverChunks) {
    const file = join(NEXT, chunk);
    if (existsSync(file)) hash.update(normalize(read(file)));
  }

  // Browser chunks its client components need.
  if (existsSync(clientManifest)) {
    const source = normalize(read(clientManifest));
    hash.update(source);
    const clientChunks = [
      ...new Set(
        [...source.matchAll(/"\/_next\/(static\/[^"]+)"/g)].map((m) => m[1]),
      ),
    ].sort();
    for (const chunk of clientChunks) {
      const file = join(NEXT, chunk);
      if (existsSync(file)) hash.update(normalize(read(file)));
    }
  }
  return hash.digest("hex").slice(0, 16);
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const routes = {};
for (const [entry, pattern] of Object.entries(routesManifest)) {
  if (!entry.endsWith("/page")) continue; // route handlers have no pages
  const fingerprint = routeFingerprint(entry);
  if (fingerprint) routes[pattern] = fingerprint;
}

const staticDir = join(NEXT, "static");
const assets = listFiles(staticDir)
  .map((file) => `/_next/${relative(NEXT, file).split("\\").join("/")}`)
  .filter(
    (url) => !url.endsWith("/offline-manifest.json") && !url.endsWith(".map"),
  )
  .sort();

writeFileSync(OUT, JSON.stringify({ buildId, routes, assets }));
console.log(
  `offline manifest: ${Object.keys(routes).length} routes, ${assets.length} assets`,
);
