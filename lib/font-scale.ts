export const FONT_SCALE_STORAGE_KEY = "font-scale";
export const MIN_FONT_SCALE = 1;
export const MAX_FONT_SCALE = 1.6;

/**
 * Runs in the page head, before first paint, so a saved text size applies
 * without the page first showing at 100% and then jumping. Same bounds as the
 * provider's own clamp.
 */
export const FONT_SCALE_INIT_SCRIPT = `try{var s=parseFloat(localStorage.getItem("${FONT_SCALE_STORAGE_KEY}"));if(s>0){document.documentElement.style.setProperty("--font-scale",String(Math.min(${MAX_FONT_SCALE},Math.max(${MIN_FONT_SCALE},Math.round(s*100)/100))))}}catch(e){}`;
