"use client";

import { useEffect } from "react";
import { startConnectionMonitor } from "@/lib/offline/connection";

/** Keeps the app's idea of the connection (good, slow, offline) current. */
export function ConnectionMonitor() {
  useEffect(() => startConnectionMonitor(), []);
  return null;
}
