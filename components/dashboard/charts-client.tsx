"use client";

import dynamic from "next/dynamic";

export const MonthlyCollectionsChartClient = dynamic(
  () => import("./monthly-collections-chart"),
  { ssr: false },
);

export const CollectionRateRingClient = dynamic(
  () => import("./collection-rate-ring"),
  { ssr: false },
);

export const OverdueByCategoryChartClient = dynamic(
  () => import("./overdue-by-category-chart"),
  { ssr: false },
);

export const OverdueAgingChartClient = dynamic(
  () => import("./overdue-aging-chart"),
  { ssr: false },
);

export const CashFlowForecastChartClient = dynamic(
  () => import("./cash-flow-forecast-chart"),
  { ssr: false },
);
