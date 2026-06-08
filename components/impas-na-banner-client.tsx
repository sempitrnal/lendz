"use client";

import dynamic from "next/dynamic";

export const ImpasNaBannerClient = dynamic(
  () => import("./impas-na-banner").then((m) => m.ImpasNaBanner),
  { ssr: false },
);
