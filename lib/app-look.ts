/**
 * The app's look: the colour of the bands, bars and pages. A per-device
 * choice, kept in localStorage and put on <html> as `data-look` before first
 * paint (see APP_LOOK_INIT_SCRIPT), so a saved look shows with no flash. The
 * colours themselves are in globals.css under `html[data-look=…]`.
 */
export type AppLook =
  | "classic"
  | "mint"
  | "lavender-paper"
  | "midnight-coral"
  | "forest-gold"
  | "mocha"
  | "indigo-peach"
  | "ocean-sand"
  | "dusty-rose"
  | "slate-tangerine"
  | "plum-gold"
  | "paper"
  | "sunset";

export const APP_LOOK_KEY = "app-look";
export const APP_LOOK_EVENT = "app-look-changed";
export const DEFAULT_APP_LOOK: AppLook = "lavender-paper";

export const APP_LOOKS: {
  id: AppLook;
  name: string;
  idea: string;
  /** Preview: the band, the page, a card. */
  swatch: [string, string, string];
  /** The accent, when it differs from the band (shown as a dot). */
  accent?: string;
}[] = [
  {
    id: "classic",
    name: "classic",
    idea: "green bands, clean white",
    swatch: ["linear-gradient(#059669,#10b981)", "#f7faf8", "#ffffff"],
  },
  {
    id: "mint",
    name: "mint garden",
    idea: "green with a soft mint page",
    swatch: ["linear-gradient(#059669,#10b981)", "#e8f4ec", "#fbfdf9"],
  },
  {
    id: "paper",
    name: "warm paper",
    idea: "green bands on sand and cream",
    swatch: ["linear-gradient(#047857,#059669)", "#f4ece0", "#fdf8ef"],
  },
  {
    id: "lavender-paper",
    name: "grape paper",
    idea: "soft violet on sand and cream",
    swatch: ["linear-gradient(#5b3b7b,#7b5a9d)", "#f4ece0", "#fdf8ef"],
  },
  {
    id: "sunset",
    name: "sunset",
    idea: "orange to pink, peach page",
    swatch: ["linear-gradient(#ea580c,#ec4899)", "#fff1ea", "#fffaf7"],
  },
  {
    id: "midnight-coral",
    name: "midnight coral",
    idea: "navy bands, cream, coral",
    swatch: ["linear-gradient(#1e2a4a,#3b496e)", "#f5f1ea", "#fffdf8"],
    accent: "#e8684a",
  },
  {
    id: "forest-gold",
    name: "forest gold",
    idea: "deep forest, linen, gold",
    swatch: ["linear-gradient(#1f3d2b,#3d5e4a)", "#f2ede1", "#fbf8f0"],
    accent: "#c08a2c",
  },
  {
    id: "mocha",
    name: "mocha caramel",
    idea: "espresso, latte, caramel",
    swatch: ["linear-gradient(#4a352b,#6d5549)", "#f3ebe1", "#fcf7f1"],
    accent: "#b8733a",
  },
  {
    id: "indigo-peach",
    name: "indigo peach",
    idea: "dusk indigo, mist, peach",
    swatch: ["linear-gradient(#2b3a67,#495b8d)", "#f2f0f7", "#fdfcff"],
    accent: "#ee8f61",
  },
  {
    id: "ocean-sand",
    name: "ocean sand",
    idea: "deep teal on beach sand",
    swatch: ["linear-gradient(#0f5469,#34778e)", "#f4ede0", "#fdf9f1"],
    accent: "#1d8a99",
  },
  {
    id: "dusty-rose",
    name: "dusty rose",
    idea: "mauve, blush, rose",
    swatch: ["linear-gradient(#8a4a63,#b26b86)", "#f8eef0", "#fffafb"],
    accent: "#b65f80",
  },
  {
    id: "slate-tangerine",
    name: "slate tangerine",
    idea: "charcoal, fog, tangerine",
    swatch: ["linear-gradient(#2f3a45,#4e5a67)", "#f2f3f1", "#ffffff"],
    accent: "#f07f2e",
  },
  {
    id: "plum-gold",
    name: "royal plum gold",
    idea: "deep plum, ivory, gold",
    swatch: ["linear-gradient(#3d2b55,#5e4a7a)", "#f6f0e6", "#fffaf2"],
    accent: "#d4a23c",
  },
];

export function isAppLook(value: unknown): value is AppLook {
  return APP_LOOKS.some((l) => l.id === value);
}

/**
 * Runs in the page head before first paint: puts the saved look (or the
 * default, when none is saved) on <html>.
 */
export const APP_LOOK_INIT_SCRIPT = `try{var l=localStorage.getItem("${APP_LOOK_KEY}");if(${JSON.stringify(
  APP_LOOKS.map((l) => l.id),
)}.indexOf(l)<0){l="${DEFAULT_APP_LOOK}"}document.documentElement.setAttribute("data-look",l)}catch(e){document.documentElement.setAttribute("data-look","${DEFAULT_APP_LOOK}")}`;
