"use client";

import { useEffect } from "react";

export default function NextScheduleScroller() {
  useEffect(() => {
    const target =
      document.getElementById("next-schedule") ??
      document.getElementById("schedule-heading");
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, []);

  return null;
}
