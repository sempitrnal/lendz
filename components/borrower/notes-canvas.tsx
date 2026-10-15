"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  Canvas,
  config,
  PencilBrush,
  Point,
  Text,
  type FabricObject,
  type Path,
  type TMat2D,
  type Canvas as FabricCanvas,
} from "fabric";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Undo2,
  Redo2,
  Hand,
  ZoomIn,
  ZoomOut,
  Pencil,
  Eraser,
  PaintBucket,
  MousePointer2,
  Type,
  Trash2,
  Scan,
  LoaderCircle,
  RotateCcw,
  Minus,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

/** Theme tokens for canvas background and ink. */
const NOTES_LIGHT_BG = "#fffdf5";
const NOTES_DARK_BG = "#1c1917";
const NOTES_LIGHT_INK = "#111111";
const NOTES_DARK_INK = "#f0ebe0";

/**
 * Sentinels stored in `obj.data` to mark "use current theme color".
 * Custom colors have `null` / undefined instead.
 */
const INK_SENTINEL = "__ink__";
const PAPER_SENTINEL = "__paper__";

/** Quick-pick colors shown next to the adaptive ink swatch. */
const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
/** Max pointer travel (px) for a press to count as a tap/click. */
const TAP_SLOP = 8;

const PREVIEW_OPTIONS = {
  format: "webp" as const,
  quality: 0.85,
  multiplier: 2,
  enableRetinaScaling: true,
};

const STORAGE_BUCKET = "borrower-notes";
const STORAGE_PUBLIC_MARKER = `/object/public/${STORAGE_BUCKET}/`;

type ObjectData = Record<string, unknown>;

function getData(obj: FabricObject): ObjectData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((obj as any).data as ObjectData) ?? {};
}

function setData(obj: FabricObject, data: ObjectData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (obj as any).data = data;
}

function hasCustomBg(canvas: FabricCanvas): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Boolean((canvas as any).customBg);
}

function setCustomBg(canvas: FabricCanvas, value: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (canvas as any).customBg = value;
}

function getTheme(dark: boolean) {
  return dark
    ? { bg: NOTES_DARK_BG, ink: NOTES_DARK_INK }
    : { bg: NOTES_LIGHT_BG, ink: NOTES_LIGHT_INK };
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/**
 * Map sentinel `data` values on every object to the resolved colors for
 * `dark`.  "Paper" strokes (eraser marks) follow the custom background when
 * one is set, so they stay invisible after a bucket fill or a theme switch.
 * The theme background is applied unless the user painted a custom one.
 */
function resolveThemeColors(canvas: FabricCanvas, dark: boolean) {
  const { bg, ink } = getTheme(dark);
  const custom = hasCustomBg(canvas);
  if (!custom) {
    canvas.backgroundColor = bg;
  }
  const paper =
    custom && typeof canvas.backgroundColor === "string"
      ? canvas.backgroundColor
      : bg;
  for (const obj of canvas.getObjects()) {
    const d = getData(obj);
    if (d.logicalStroke === INK_SENTINEL) {
      const alpha = typeof d.strokeOpacity === "number" ? d.strokeOpacity : 1;
      obj.set("stroke", hexToRgba(ink, alpha));
    } else if (d.logicalStroke === PAPER_SENTINEL) {
      obj.set("stroke", paper);
    }
    if (d.logicalFill === INK_SENTINEL) {
      const alpha = typeof d.fillOpacity === "number" ? d.fillOpacity : 1;
      obj.set("fill", hexToRgba(ink, alpha));
    }
  }
}

function applyThemeToCanvas(canvas: FabricCanvas, dark: boolean) {
  resolveThemeColors(canvas, dark);
  canvas.renderAll();
}

/**
 * Temporarily apply a theme, capture a dataURL, then restore original
 * per-object colors and background.  Does NOT call renderAll at the end
 * — the caller must do that if they need to display the canvas again.
 */
function renderWithTheme(canvas: FabricCanvas, dark: boolean): string {
  const origBg = canvas.backgroundColor;
  const objects = canvas.getObjects();
  const origColors = objects.map((obj) => ({
    stroke: obj.stroke,
    fill: obj.fill,
  }));

  resolveThemeColors(canvas, dark);
  canvas.renderAll();

  const dataUrl = canvas.toDataURL(PREVIEW_OPTIONS);

  // Restore
  canvas.backgroundColor = origBg;
  objects.forEach((obj, i) => {
    obj.set("stroke", origColors[i].stroke);
    obj.set("fill", origColors[i].fill);
  });

  return dataUrl;
}

/**
 * Copy the `data` field from raw JSON objects back onto deserialized Fabric
 * objects (index-matched).  Fabric's `loadFromJSON` does not guarantee that
 * extra properties like `data` survive the round-trip.
 */
function restoreObjectData(
  canvas: FabricCanvas,
  json: Record<string, unknown>,
) {
  const rawObjects = (json.objects as Record<string, unknown>[]) ?? [];
  canvas.getObjects().forEach((obj, i) => {
    const rawData = rawObjects[i]?.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (rawData && !(obj as any).data) {
      setData(obj, rawData as ObjectData);
    }
  });
}

/**
 * Auto-tag objects whose stroke/fill is a known ink or paper constant so that
 * notes created before theme-awareness was added still adapt correctly.
 * Also handles the case where `data` was stripped by Fabric deserialization.
 */
function tagLegacyObjects(canvas: FabricCanvas) {
  for (const obj of canvas.getObjects()) {
    const existing = getData(obj);
    if (existing.logicalStroke || existing.logicalFill) continue;

    const stroke = obj.stroke as string | null | undefined;
    const fill = obj.fill as string | null | undefined;
    const data: ObjectData = { ...existing };

    if (stroke === NOTES_LIGHT_INK || stroke === NOTES_DARK_INK) {
      data.logicalStroke = INK_SENTINEL;
    } else if (stroke === NOTES_LIGHT_BG || stroke === NOTES_DARK_BG) {
      data.logicalStroke = PAPER_SENTINEL;
    }
    if (fill === NOTES_LIGHT_INK || fill === NOTES_DARK_INK) {
      data.logicalFill = INK_SENTINEL;
    }

    if (data.logicalStroke || data.logicalFill) {
      setData(obj, data);
    }
  }
}

/** Serialize the canvas for history / drafts. */
function snapshotCanvas(canvas: FabricCanvas): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (canvas as any).toJSON(["data", "id"]) as Record<
    string,
    unknown
  >;
  json.backgroundColor = canvas.backgroundColor;
  json.customBg = hasCustomBg(canvas);
  return json;
}

/** Compress a JSON value to a base64-encoded gzip string. */
async function compressJSON(data: unknown): Promise<string> {
  const json = JSON.stringify(data);
  const blob = new Blob([json]);
  const cs = new CompressionStream("gzip");
  const stream = blob.stream().pipeThrough(cs);
  const compressed = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(compressed);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decompress a base64-encoded gzip string back to a parsed JSON value. */
async function decompressJSON(base64: string): Promise<unknown> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes]);
  const ds = new DecompressionStream("gzip");
  const stream = blob.stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

/** Check if a value is a compressed base64 string (not a plain object). */
function isCompressed(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+);/.exec(header)?.[1] ?? "image/webp";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function storagePathFromUrl(url: string | null | undefined) {
  return url?.split(STORAGE_PUBLIC_MARKER)[1] ?? null;
}

/** Best-effort removal of preview files; failures only leave orphans. */
async function removeStoragePaths(paths: (string | null)[]) {
  const valid = paths.filter((p): p is string => Boolean(p));
  if (valid.length === 0) return;
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove(valid);
  } catch (err) {
    console.error("Failed to remove old note previews", err);
  }
}

async function uploadPreviewImage(dataUrl: string, fileName: string) {
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, blob, { contentType: blob.type });

  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

/** Strip a serialized canvas down to the fields needed to restore it. */
function slimCanvasJSON(rawJSON: Record<string, unknown>) {
  if (!Array.isArray(rawJSON.objects)) return rawJSON;
  rawJSON.objects = (rawJSON.objects as Record<string, unknown>[]).map(
    (obj) => {
      const {
        left,
        top,
        width,
        height,
        scaleX,
        scaleY,
        angle,
        type,
        path,
        text,
        id,
        data,
        fontSize,
        fontFamily,
        stroke,
        strokeWidth,
        fill,
        globalCompositeOperation,
        strokeLineCap,
        strokeLineJoin,
        opacity,
      } = obj;
      const slim: Record<string, unknown> = { type };
      if (id !== undefined) slim.id = id;
      if (data !== undefined) slim.data = data;
      if (text !== undefined) slim.text = text;
      if (fontSize !== undefined) slim.fontSize = fontSize;
      if (fontFamily !== undefined) slim.fontFamily = fontFamily;
      if (path !== undefined) slim.path = path;
      if (left !== undefined) slim.left = left;
      if (top !== undefined) slim.top = top;
      if (width !== undefined) slim.width = width;
      if (height !== undefined) slim.height = height;
      if (scaleX !== undefined && scaleX !== 1) slim.scaleX = scaleX;
      if (scaleY !== undefined && scaleY !== 1) slim.scaleY = scaleY;
      if (angle !== undefined && angle !== 0) slim.angle = angle;
      if (stroke !== undefined) slim.stroke = stroke;
      if (strokeWidth !== undefined) slim.strokeWidth = strokeWidth;
      if (fill !== undefined) slim.fill = fill;
      if (globalCompositeOperation !== undefined)
        slim.globalCompositeOperation = globalCompositeOperation;
      if (strokeLineCap !== undefined) slim.strokeLineCap = strokeLineCap;
      if (strokeLineJoin !== undefined) slim.strokeLineJoin = strokeLineJoin;
      if (opacity !== undefined && opacity !== 1) slim.opacity = opacity;
      return slim;
    },
  );
  return rawJSON;
}

function paperStrokeColor(canvas: FabricCanvas): string {
  const bg = canvas.backgroundColor;
  return typeof bg === "string" && bg.length > 0 ? bg : NOTES_LIGHT_BG;
}

function isPaperPath(obj: FabricObject) {
  return getData(obj).logicalStroke === PAPER_SENTINEL;
}

/** Topmost visible object under `pointer` (scene coords) that passes `accept`. */
function findObjectAt(
  canvas: FabricCanvas,
  pointer: { x: number; y: number },
  accept: (obj: FabricObject) => boolean,
) {
  const objects = canvas.getObjects();
  const pt = new Point(pointer.x, pointer.y);
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.visible && accept(obj) && obj.containsPoint(pt)) {
      return obj;
    }
  }
  return null;
}

/** Ring cursor matching the on-screen brush diameter. */
function brushCursor(diameter: number) {
  const d = Math.max(4, Math.min(120, Math.round(diameter)));
  const size = d + 4;
  const c = size / 2;
  const r = d / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="white" stroke-width="2.5"/>` +
    `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="black" stroke-width="1"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`;
}

/** Minimal fields used by the canvas; note rows may include more from Supabase. */
export type BorrowerNotePayload = Record<string, unknown> & {
  id?: string;
  canvas_json?: unknown;
  preview_img_url?: string | null;
};

type NotesCanvasProps = {
  borrowerId: string;
  note?: BorrowerNotePayload;
  draft?: Record<string, unknown> | null;
  onDraftChange?: (json: Record<string, unknown>) => void;
  onSaved?: (note: BorrowerNotePayload) => void;
};

type DrawTool = "pen" | "eraser" | "bucket" | "select" | "pan" | "text";

type TextEdit = {
  /** Top-left of the text box in scene coordinates. */
  x: number;
  y: number;
  value: string;
  fontSize: number;
  color: string;
  /** Existing text object being edited (hidden while the overlay is open). */
  target?: Text;
};

const TOOLS: {
  id: DrawTool;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}[] = [
  { id: "pen", label: "Pen", shortcut: "P", icon: Pencil },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "bucket", label: "Fill", shortcut: "B", icon: PaintBucket },
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "pan", label: "Pan", shortcut: "H", icon: Hand },
];

const TOOL_BY_SHORTCUT: Record<string, DrawTool> = Object.fromEntries(
  TOOLS.map((t) => [t.shortcut.toLowerCase(), t.id]),
);

const TOOL_HINTS: Partial<Record<DrawTool, string>> = {
  pen: "Pinch to zoom · two-finger tap to undo",
  eraser: "Paints over ink with the paper color",
  text: "Tap to add text · tap existing text to edit",
  bucket: "Tap a shape to fill it, or the paper to color it",
  select: "Drag to move · Delete to remove",
  pan: "Drag to move · pinch or scroll to zoom",
};

/**
 * Feeds every coalesced pointer sample into the stroke.  Styluses report at
 * 120–240 Hz but browsers dispatch one pointermove per frame, so without
 * this fast handwriting turns into visible straight segments.
 */
class SmoothPencilBrush extends PencilBrush {
  override onMouseMove(
    pointer: Point,
    ev: Parameters<PencilBrush["onMouseMove"]>[1],
  ) {
    const e = ev.e as PointerEvent;
    const samples =
      typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    if (samples.length <= 1) {
      super.onMouseMove(pointer, ev);
      return;
    }
    // Fabric caches the pointer of the event being handled, so
    // getScenePoint() would return the same point for every sample; map
    // each one ourselves (the viewport only ever scales and translates).
    const el = this.canvas.upperCanvasEl;
    const rect = el.getBoundingClientRect();
    const retina = this.canvas.getRetinaScaling();
    // Same CSS-scale correction Fabric applies (e.g. mid dialog animation)
    const kx = rect.width ? el.width / retina / rect.width : 1;
    const ky = rect.height ? el.height / retina / rect.height : 1;
    const [a, , , d, tx, ty] = this.canvas.viewportTransform;
    for (const sample of samples) {
      const point = new Point(
        ((sample.clientX - rect.left - tx) / a) * kx,
        ((sample.clientY - rect.top - ty) / d) * ky,
      );
      super.onMouseMove(point, ev);
    }
  }
}

class EraserPencilBrush extends SmoothPencilBrush {
  override _setBrushStyles(ctx: CanvasRenderingContext2D) {
    super._setBrushStyles(ctx);
    ctx.strokeStyle = paperStrokeColor(this.canvas);
    ctx.globalCompositeOperation = "source-over";
  }

  override _render(ctx = this.canvas.contextTop) {
    let p1 = this._points[0];
    let p2 = this._points[1];
    this._saveAndTransform(ctx);
    this._setBrushStyles(ctx);
    ctx.beginPath();
    if (this._points.length === 2 && p1.x === p2.x && p1.y === p2.y) {
      const w = this.width / 1e3;
      p1.x -= w;
      p2.x += w;
    }
    ctx.moveTo(p1.x, p1.y);
    for (let i = 1; i < this._points.length; i++) {
      PencilBrush.drawSegment(ctx, p1, p2);
      p1 = this._points[i];
      p2 = this._points[i + 1];
    }
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
  }

  override createPath(
    pathData: Parameters<PencilBrush["createPath"]>[0],
  ): Path {
    const path = super.createPath(pathData);
    path.set({
      stroke: paperStrokeColor(this.canvas),
      globalCompositeOperation: "source-over",
    });
    setData(path, { logicalStroke: PAPER_SENTINEL });
    return path;
  }
}

const ERASER_WIDTH = 14;
const DEFAULT_PEN_WIDTH = 2;
const DEFAULT_PEN_OPACITY = 1;
const DEFAULT_TEXT_SIZE = 24;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
  if (target.tagName !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["range", "color", "checkbox", "radio", "button"].includes(type);
}

const PEN_ONLY_STORAGE_KEY = "notes-canvas:pen-only";

function readPenOnlyPref(): boolean | null {
  try {
    const value = window.localStorage.getItem(PEN_ONLY_STORAGE_KEY);
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

function writePenOnlyPref(value: boolean) {
  try {
    window.localStorage.setItem(PEN_ONLY_STORAGE_KEY, value ? "1" : "0");
  } catch {}
}

/** Shared look for the translucent controls floating over the canvas. */
const FLOATING_SURFACE = `border border-slate-200/80 bg-white/90 shadow-lg
  shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/80
  dark:bg-slate-900/90 dark:shadow-black/30`;

function ToolbarButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
  className,
  ...aria
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      {...aria}
      className={cn(
        `inline-flex size-10 shrink-0 touch-manipulation items-center
        justify-center rounded-xl text-slate-600 transition-colors outline-none
        select-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2
        focus-visible:ring-sky-500 active:scale-95 disabled:pointer-events-none
        disabled:opacity-30 sm:size-9 sm:rounded-lg dark:text-slate-300
        dark:hover:bg-slate-800 dark:hover:text-white [&_svg]:size-5
        sm:[&_svg]:size-[18px]`,
        active &&
          `bg-slate-900 text-white shadow-sm hover:bg-slate-900 hover:text-white
          dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100
          dark:hover:text-slate-900`,
        className,
      )}
    >
      {children}
    </button>
  );
}

function DockDivider() {
  return (
    <span
      aria-hidden
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700"
    />
  );
}

function OptionRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-14 shrink-0 text-[10px] font-bold text-slate-500 uppercase
          dark:text-slate-400"
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <OptionRow label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-8 min-w-0 flex-1 cursor-pointer touch-pan-x
          accent-slate-900 dark:accent-slate-100"
      />
      <span
        className="w-10 shrink-0 text-right text-xs font-bold text-slate-600
          tabular-nums dark:text-slate-300"
      >
        {display}
      </span>
    </OptionRow>
  );
}

export default function NotesCanvas({
  borrowerId,
  note,
  draft,
  onDraftChange,
  onSaved,
}: NotesCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [showOptions, setShowOptions] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penOnly, setPenOnly] = useState(() => readPenOnlyPref() ?? false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [hasSelection, setHasSelection] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [brushIsInk, setBrushIsInk] = useState(true);
  const [brushColor, setBrushColor] = useState(NOTES_LIGHT_INK);
  const [brushSize, setBrushSize] = useState(DEFAULT_PEN_WIDTH);
  const [brushOpacity, setBrushOpacity] = useState(DEFAULT_PEN_OPACITY);
  const [eraserSize, setEraserSize] = useState(ERASER_WIDTH);
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_SIZE);
  const [activeTool, setActiveTool] = useState<DrawTool>("pen");
  const [viewport, setViewport] = useState<TMat2D>([1, 0, 0, 1, 0, 0]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [textInput, setTextInput] = useState<TextEdit | null>(null);

  const zoom = viewport[0];

  // Mutable mirrors so long-lived canvas listeners always see latest values
  const isDarkRef = useRef(false);
  const brushIsInkRef = useRef(true);
  const brushColorRef = useRef(brushColor);
  const brushOpacityRef = useRef(DEFAULT_PEN_OPACITY);
  const textSizeRef = useRef(DEFAULT_TEXT_SIZE);
  const activeToolRef = useRef<DrawTool>(activeTool);
  const textInputRef = useRef<TextEdit | null>(null);
  const savingRef = useRef(false);
  const spaceRestoreToolRef = useRef<DrawTool | null>(null);
  const penOnlyRef = useRef(penOnly);
  const penDetectedRef = useRef<() => void>(() => {});
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  const historyRef = useRef<Record<string, unknown>[]>([]);
  const historyIndexRef = useRef(-1);
  const historyBusyRef = useRef(false);
  const maxHistory = 50;
  const onDraftChangeRef = useRef(onDraftChange);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  useEffect(() => {
    isDarkRef.current = isDark;
    brushIsInkRef.current = brushIsInk;
    brushColorRef.current = brushColor;
    brushOpacityRef.current = brushOpacity;
    textSizeRef.current = textSize;
    activeToolRef.current = activeTool;
    penOnlyRef.current = penOnly;
  }, [
    isDark,
    brushIsInk,
    brushColor,
    brushOpacity,
    textSize,
    activeTool,
    penOnly,
  ]);

  const syncHistoryState = useCallback(() => {
    setHistory({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  }, []);

  const emitDraft = useCallback((json: Record<string, unknown>) => {
    const canvas = fabricRef.current;
    onDraftChangeRef.current?.({
      ...json,
      viewportTransform: canvas
        ? ([...canvas.viewportTransform] as TMat2D)
        : undefined,
    });
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = snapshotCanvas(canvas);
    // Remove entries ahead if we're not at the top
    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    historyRef.current.push(json);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current += 1;
    }
    syncHistoryState();
    setDirty(true);
    emitDraft(json);
  }, [syncHistoryState, emitDraft]);

  const applyDrawingBrush = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Only the select tool may pick up / move objects; every other tool
    // hit-tests manually so strokes can't be dragged around by accident.
    const isSelect = activeTool === "select";
    canvas.selection = isSelect;
    canvas.skipTargetFind = !isSelect;
    canvas.hoverCursor = "move";
    canvas.forEachObject((obj) => {
      obj.selectable = isSelect;
    });
    if (!isSelect && canvas.getActiveObject()) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }

    if (activeTool !== "pen" && activeTool !== "eraser") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor =
        activeTool === "text"
          ? "text"
          : activeTool === "bucket"
            ? "crosshair"
            : activeTool === "pan"
              ? "grab"
              : "default";
      canvas.setCursor(canvas.defaultCursor);
      return;
    }

    canvas.isDrawingMode = true;
    canvas.defaultCursor = "crosshair";

    if (activeTool === "eraser") {
      const brush = new EraserPencilBrush(canvas);
      brush.width = eraserSize;
      brush.color = "#000000";
      canvas.freeDrawingBrush = brush;
    } else {
      const brush = new SmoothPencilBrush(canvas);
      brush.width = brushSize;
      const baseColor = brushIsInk ? getTheme(isDark).ink : brushColor;
      brush.color = hexToRgba(baseColor, brushOpacity);
      canvas.freeDrawingBrush = brush;
    }
  }, [
    activeTool,
    brushColor,
    brushSize,
    brushOpacity,
    brushIsInk,
    eraserSize,
    isDark,
  ]);

  const applyDrawingBrushRef = useRef(applyDrawingBrush);

  useEffect(() => {
    applyDrawingBrushRef.current = applyDrawingBrush;
    applyDrawingBrush();
  }, [applyDrawingBrush]);

  // Brush-sized ring cursor for pen / eraser
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const width =
      activeTool === "eraser"
        ? eraserSize
        : activeTool === "pen"
          ? brushSize
          : 0;
    canvas.freeDrawingCursor = width ? brushCursor(width * zoom) : "crosshair";
  }, [activeTool, brushSize, eraserSize, zoom, ready]);

  const restoreCanvasState = useCallback(
    (canvas: Canvas, json: Record<string, unknown>) => {
      if (typeof json.backgroundColor === "string") {
        canvas.backgroundColor = json.backgroundColor;
      }
      setCustomBg(canvas, Boolean(json.customBg));
      restoreObjectData(canvas, json);
      tagLegacyObjects(canvas);
      applyThemeToCanvas(canvas, isDarkRef.current);
      applyDrawingBrushRef.current();
    },
    [],
  );

  const goToHistory = useCallback(
    async (index: number) => {
      const canvas = fabricRef.current;
      if (!canvas || historyBusyRef.current) return;
      if (index < 0 || index >= historyRef.current.length) return;
      historyBusyRef.current = true;
      historyIndexRef.current = index;
      const json = historyRef.current[index];
      try {
        await canvas.loadFromJSON(json);
        if (fabricRef.current !== canvas) return;
        restoreCanvasState(canvas, json);
        setDirty(true);
        emitDraft(json);
      } catch (err) {
        console.error("Failed to restore history", err);
      } finally {
        historyBusyRef.current = false;
        syncHistoryState();
      }
    },
    [restoreCanvasState, syncHistoryState, emitDraft],
  );

  const undo = useCallback(() => {
    void goToHistory(historyIndexRef.current - 1);
  }, [goToHistory]);

  const redo = useCallback(() => {
    void goToHistory(historyIndexRef.current + 1);
  }, [goToHistory]);

  const setTextEdit = useCallback((edit: TextEdit | null) => {
    textInputRef.current = edit;
    setTextInput(edit);
  }, []);

  const startTextEdit = useCallback(
    (pointer: { x: number; y: number }) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const target = findObjectAt(
        canvas,
        pointer,
        (obj) => obj instanceof Text,
      ) as Text | null;

      let edit: TextEdit;
      if (target) {
        // Fabric v7 objects default to a center origin, so anchor the
        // overlay on the visual top-left corner instead of left/top.
        const topLeft = target.getPointByOrigin("left", "top");
        edit = {
          x: topLeft.x,
          y: topLeft.y,
          value: target.text ?? "",
          fontSize:
            (target.fontSize ?? DEFAULT_TEXT_SIZE) * (target.scaleY ?? 1),
          color:
            typeof target.fill === "string" ? target.fill : NOTES_LIGHT_INK,
          target,
        };
        target.visible = false;
        canvas.requestRenderAll();
      } else {
        edit = {
          x: pointer.x,
          y: pointer.y,
          value: "",
          fontSize: textSizeRef.current,
          color: brushIsInkRef.current
            ? getTheme(isDarkRef.current).ink
            : brushColorRef.current,
        };
      }
      // Flush synchronously so the textarea focuses inside the user
      // gesture (required for the on-screen keyboard on iOS).
      flushSync(() => setTextEdit(edit));
    },
    [setTextEdit],
  );

  const commitText = useCallback(() => {
    const edit = textInputRef.current;
    const canvas = fabricRef.current;
    if (!edit) return;
    setTextEdit(null);
    if (!canvas) return;

    const { target, value } = edit;
    const hasText = value.trim().length > 0;

    if (target && canvas.getObjects().includes(target)) {
      target.visible = true;
      if (target.text === value) {
        canvas.requestRenderAll();
        return;
      }
      if (hasText) {
        const topLeft = target.getPointByOrigin("left", "top");
        target.set("text", value);
        target.setPositionByOrigin(topLeft, "left", "top");
        target.setCoords();
      } else {
        canvas.remove(target);
      }
    } else if (hasText) {
      const isInk = brushIsInkRef.current;
      const text = new Text(value, {
        fontSize: edit.fontSize,
        fill: isInk ? getTheme(isDarkRef.current).ink : edit.color,
        fontFamily: "sans-serif",
      });
      text.setPositionByOrigin(new Point(edit.x, edit.y), "left", "top");
      text.setCoords();
      (text as unknown as { id: string }).id = crypto.randomUUID();
      setData(text, { logicalFill: isInk ? INK_SENTINEL : null });
      canvas.add(text);
    } else {
      return;
    }

    canvas.requestRenderAll();
    pushHistory();
  }, [pushHistory, setTextEdit]);

  const cancelText = useCallback(() => {
    const edit = textInputRef.current;
    setTextEdit(null);
    if (edit?.target) {
      edit.target.visible = true;
      fabricRef.current?.requestRenderAll();
    }
  }, [setTextEdit]);

  const setPenOnlyPref = useCallback((value: boolean) => {
    setPenOnly(value);
    writePenOnlyPref(value);
  }, []);

  // First stylus contact: switch to pen-only unless the user already chose
  const handlePenDetected = useCallback(() => {
    if (penOnlyRef.current || readPenOnlyPref() !== null) return;
    penOnlyRef.current = true;
    setPenOnlyPref(true);
    toast("Stylus detected", {
      description:
        "Only the pen draws now. One finger pans, two fingers zoom, two-finger tap undoes.",
    });
  }, [setPenOnlyPref]);

  const commitTextRef = useRef(commitText);
  const startTextEditRef = useRef(startTextEdit);
  useEffect(() => {
    commitTextRef.current = commitText;
    startTextEditRef.current = startTextEdit;
    penDetectedRef.current = handlePenDetected;
    undoRef.current = undo;
    redoRef.current = redo;
  }, [commitText, startTextEdit, handlePenDetected, undo, redo]);

  // Escape inside the text overlay must cancel the edit, not close the
  // surrounding dialog (Radix listens for Escape on document capture).
  const isEditingText = textInput !== null;
  useEffect(() => {
    if (!isEditingText) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      cancelText();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isEditingText, cancelText]);

  // Detect dark mode from the <html class="dark"> toggle (next-themes)
  useEffect(() => {
    const check = () => {
      const dark = document.documentElement.classList.contains("dark");
      setIsDark(dark);
      isDarkRef.current = dark;
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Re-apply theme whenever dark mode changes (brush follows via its deps)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    applyThemeToCanvas(canvas, isDark);
  }, [isDark]);

  // Warn before a full page unload while there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // initialize canvas
  useEffect(() => {
    if (!canvasElRef.current) return;

    // 3× phone screens triple the pixels redrawn per stroke for no visible
    // gain on handwriting; 2× keeps ink crisp and drawing responsive.
    config.configure({
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });

    const canvas = new Canvas(canvasElRef.current, {
      backgroundColor: NOTES_LIGHT_BG,
      isDrawingMode: true,
      preserveObjectStacking: true,
      // Pointer events expose pointerType, so stylus and finger input can
      // be told apart (palm rejection, finger panning).
      enablePointerEvents: true,
    });
    const upperCanvas = canvas.upperCanvasEl;

    if (upperCanvas) {
      upperCanvas.tabIndex = -1;
    }
    upperCanvas?.blur();
    fabricRef.current = canvas;

    let disposed = false;

    // Batch viewport → React state updates to one per frame
    let viewportRaf: number | null = null;
    const syncViewport = () => {
      if (viewportRaf !== null) return;
      viewportRaf = requestAnimationFrame(() => {
        viewportRaf = null;
        if (disposed) return;
        setViewport([...canvas.viewportTransform] as TMat2D);
      });
    };

    const resizeCanvas = () => {
      if (!fabricRef.current || !containerRef.current) return;

      const c = fabricRef.current;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight || 300;

      c.setDimensions({
        width,
        height,
      });

      c.calcOffset();
      c.renderAll();
    };

    // Initial resize after layout settles (dialog animation, etc.)
    const initTimeout = window.setTimeout(() => {
      resizeCanvas();
    }, 50);

    // ResizeObserver catches container width changes even when window doesn't resize
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(containerRef.current);
    } else {
      window.addEventListener("resize", resizeCanvas);
    }

    const syncEmpty = () => {
      if (!disposed) setIsEmpty(canvas.getObjects().length === 0);
    };

    const loadJSON = async (json: Record<string, unknown>) => {
      await canvas.loadFromJSON(json);
      if (disposed) return false;
      if (typeof json.backgroundColor === "string") {
        canvas.backgroundColor = json.backgroundColor;
      }
      setCustomBg(canvas, Boolean(json.customBg));
      restoreObjectData(canvas, json);
      tagLegacyObjects(canvas);
      applyThemeToCanvas(canvas, isDarkRef.current);
      const vpt = json.viewportTransform;
      if (Array.isArray(vpt) && vpt.length === 6) {
        canvas.setViewportTransform([...vpt] as TMat2D);
      }
      return true;
    };

    // load saved JSON (supports both compressed and legacy uncompressed)
    const loadCanvas = async () => {
      let loadedDraft = false;
      let loaded = false;

      // 1. Prefer unsaved draft (accidental-close recovery)
      if (draft) {
        try {
          loaded = loadedDraft = await loadJSON(draft);
        } catch (err) {
          // A canvas disposed mid-load (dev double-mount) throws here
          if (!disposed) console.error("Failed to load draft", err);
        }
      }

      // 2. Fall back to saved note JSON
      if (!loaded && note?.canvas_json) {
        try {
          let jsonData: unknown = note.canvas_json;
          if (isCompressed(jsonData)) {
            jsonData = await decompressJSON(jsonData);
          }
          if (disposed) return;
          loaded = await loadJSON(jsonData as Record<string, unknown>);
        } catch (err) {
          if (!disposed) {
            console.error("Failed to load canvas JSON", err);
            toast.error("Couldn't load this note");
          }
        }
      }

      if (disposed) return;
      applyThemeToCanvas(canvas, isDarkRef.current);
      applyDrawingBrushRef.current();
      syncViewport();
      syncEmpty();

      // seed initial history after load
      requestAnimationFrame(() => {
        if (disposed) return;
        historyRef.current = [snapshotCanvas(canvas)];
        historyIndexRef.current = 0;
        syncHistoryState();
        setDirty(loadedDraft);
        setReady(true);
      });
    };
    void loadCanvas();

    // Push state on every completed stroke; tag ink paths with INK_SENTINEL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlePathCreated = (opt: any) => {
      if (opt.path && activeToolRef.current !== "eraser") {
        const logicalStroke = brushIsInkRef.current ? INK_SENTINEL : null;
        const data: ObjectData = { logicalStroke };
        if (logicalStroke) {
          data.strokeOpacity = brushOpacityRef.current;
        }
        opt.path.data = data;
        // Ensure resolved color matches current theme
        if (logicalStroke === INK_SENTINEL) {
          opt.path.set(
            "stroke",
            hexToRgba(getTheme(isDarkRef.current).ink, brushOpacityRef.current),
          );
        }
      }
      pushHistory();
    };
    canvas.on("path:created", handlePathCreated);

    const onObjectAdded = ({ target }: { target: FabricObject }) => {
      target.selectable = activeToolRef.current === "select";
      syncEmpty();
    };
    canvas.on("object:added", onObjectAdded);
    canvas.on("object:removed", syncEmpty);

    // Moves / scales / rotations in select mode are undoable too
    const onObjectModified = () => pushHistory();
    canvas.on("object:modified", onObjectModified);

    const syncSelection = () => {
      setHasSelection(canvas.getActiveObjects().length > 0);
    };
    canvas.on("selection:created", syncSelection);
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", syncSelection);

    // Gesture bookkeeping shared with tap detection below
    let isPinching = false;
    let gestureHadPinch = false;
    let strokeStartedAt = 0;

    const fillAt = (pointer: { x: number; y: number }) => {
      const isInk = brushIsInkRef.current;
      const resolvedFill = isInk
        ? getTheme(isDarkRef.current).ink
        : brushColorRef.current;
      const opacity = brushOpacityRef.current;

      // Eraser marks are "paper", so clicks on them fall through
      const target = findObjectAt(canvas, pointer, (obj) => !isPaperPath(obj));
      if (target) {
        target.set("fill", hexToRgba(resolvedFill, opacity));
        setData(target, {
          ...getData(target),
          logicalFill: isInk ? INK_SENTINEL : null,
          fillOpacity: isInk ? opacity : undefined,
        });
      } else {
        // The paper itself is always painted opaque so eraser marks
        // (which reuse the background color) stay invisible.
        canvas.backgroundColor = hexToRgba(resolvedFill, 1);
        setCustomBg(canvas, true);
        resolveThemeColors(canvas, isDarkRef.current);
      }

      canvas.renderAll();
      pushHistory();
    };

    // Pan tool — drag to move viewport
    let isPanning = false;
    let panLastX = 0;
    let panLastY = 0;
    let downX = 0;
    let downY = 0;
    let textClickConsumed = false;
    const getPoint = (e: MouseEvent | TouchEvent) =>
      "touches" in e && e.touches.length > 0
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : "changedTouches" in e && e.changedTouches.length > 0
          ? {
              x: e.changedTouches[0].clientX,
              y: e.changedTouches[0].clientY,
            }
          : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

    const onMouseDown = (opt: { e: MouseEvent | TouchEvent }) => {
      const p = getPoint(opt.e);
      downX = p.x;
      downY = p.y;
      strokeStartedAt = performance.now();
      if (isPinching) return;
      setShowOptions(false);

      // Clicking away from an open text overlay finishes it first
      if (textInputRef.current) {
        commitTextRef.current();
        textClickConsumed = true;
        return;
      }
      textClickConsumed = false;
      if (canvas.isDrawingMode) setIsDrawing(true);

      if (activeToolRef.current !== "pan") return;
      isPanning = true;
      panLastX = p.x;
      panLastY = p.y;
      canvas.setCursor("grabbing");
    };
    const onMouseMove = (opt: { e: MouseEvent | TouchEvent }) => {
      if (!isPanning || isPinching || activeToolRef.current !== "pan") return;
      const p = getPoint(opt.e);
      canvas.relativePan(new Point(p.x - panLastX, p.y - panLastY));
      panLastX = p.x;
      panLastY = p.y;
      syncViewport();
    };
    const onMouseUp = (opt: { e: MouseEvent | TouchEvent }) => {
      setIsDrawing(false);
      if (isPanning) {
        isPanning = false;
        if (activeToolRef.current === "pan") canvas.setCursor("grab");
      }

      const consumed = textClickConsumed;
      textClickConsumed = false;
      if (gestureHadPinch || isPinching || consumed) return;

      const p = getPoint(opt.e);
      const isTap = Math.hypot(p.x - downX, p.y - downY) <= TAP_SLOP;
      if (!isTap) return;

      const tool = activeToolRef.current;
      if (tool === "bucket") {
        fillAt(canvas.getScenePoint(opt.e));
      } else if (tool === "text") {
        startTextEditRef.current(canvas.getScenePoint(opt.e));
      }
    };
    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);

    // Wheel: scroll to pan, Ctrl/⌘ + wheel (or trackpad pinch) to zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (e.ctrlKey || e.metaKey) {
        const rect = (
          upperCanvas ?? canvas.lowerCanvasEl
        ).getBoundingClientRect();
        const delta = Math.max(-30, Math.min(30, dy));
        const next = clampZoom(canvas.getZoom() * Math.exp(-delta * 0.01));
        canvas.zoomToPoint(
          new Point(e.clientX - rect.left, e.clientY - rect.top),
          next,
        );
      } else if (e.shiftKey && dx === 0) {
        canvas.relativePan(new Point(-dy, 0));
      } else {
        canvas.relativePan(new Point(-dx, -dy));
      }
      syncViewport();
    };
    upperCanvas?.addEventListener("wheel", onWheel, { passive: false });

    // Block browser gestures on the upper canvas element
    if (upperCanvas) upperCanvas.style.touchAction = "none";

    // ── Touch & stylus gestures ─────────────────────────────────────────
    // Captured on window so pointers are seen before Fabric and can be kept
    // away from it:
    //  • two fingers pinch-zoom and pan; a quick two-finger tap undoes,
    //    a three-finger tap redoes
    //  • with "pen only" on, one finger pans instead of drawing
    //  • skin contacts while (or right after) the stylus is down are ignored
    const touches = new Map<number, { x: number; y: number }>();
    const touchStarts = new Map<number, { x: number; y: number }>();
    const blocked = new Set<number>();
    let fingerPan: { id: number; x: number; y: number } | null = null;
    let penDown = false;
    let lastPenUpAt = 0;
    let multiTap: {
      startedAt: number;
      fingers: number;
      moved: boolean;
    } | null = null;

    let pinchStartDist = 1;
    let pinchStartZoom = 1;
    let pinchStartVpt: TMat2D = [1, 0, 0, 1, 0, 0];
    let pinchStartMid = { x: 0, y: 0 };
    let savedDrawingMode = false;
    let savedSelection = false;

    const toLocal = (e: PointerEvent) => {
      const rect = (
        upperCanvas ?? canvas.lowerCanvasEl
      ).getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const firstTwoTouches = () => {
      const [a, b] = [...touches.values()];
      return [a, b ?? a] as const;
    };

    // A stroke that only just started when the second finger landed is the
    // first half of a pinch — drop it instead of leaving a stray mark.
    const abortActiveStroke = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cAny = canvas as any;
      cAny._currentTransform = null;
      if (!cAny._isCurrentlyDrawing) return;
      const brush = cAny.freeDrawingBrush;
      if (performance.now() - strokeStartedAt < 250) {
        if (brush) {
          brush._points = [];
          brush.oldEnd = undefined;
        }
        canvas.clearContext(canvas.contextTop);
      } else {
        try {
          brush?._finalizeAndAddPath?.();
        } catch {}
      }
      cAny._isCurrentlyDrawing = false;
      canvas.requestRenderAll();
    };

    const startPinch = () => {
      const [a, b] = firstTwoTouches();
      isPinching = true;
      gestureHadPinch = true;
      isPanning = false;
      fingerPan = null;
      pinchStartDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      pinchStartZoom = canvas.getZoom();
      pinchStartVpt = [...canvas.viewportTransform] as TMat2D;
      pinchStartMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      // Suppress Fabric so the pinch is a pure viewport gesture
      savedDrawingMode = canvas.isDrawingMode;
      savedSelection = canvas.selection;
      abortActiveStroke();
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      setIsDrawing(false);
    };

    const updatePinch = () => {
      const [a, b] = firstTwoTouches();
      const scale = Math.hypot(b.x - a.x, b.y - a.y) / pinchStartDist;
      // Ignore tiny scale changes to avoid jitter while two-finger panning
      const nextZoom =
        Math.abs(scale - 1) < 0.02
          ? pinchStartZoom
          : clampZoom(pinchStartZoom * scale);

      // Keep the scene point that was under the starting midpoint under
      // the current midpoint, so the canvas follows both fingers.
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const sceneX = (pinchStartMid.x - pinchStartVpt[4]) / pinchStartVpt[0];
      const sceneY = (pinchStartMid.y - pinchStartVpt[5]) / pinchStartVpt[3];
      canvas.setViewportTransform([
        nextZoom,
        0,
        0,
        nextZoom,
        midX - sceneX * nextZoom,
        midY - sceneY * nextZoom,
      ]);
      syncViewport();
    };

    const endPinch = () => {
      isPinching = false;
      canvas.isDrawingMode = savedDrawingMode;
      canvas.selection = savedSelection;
      canvas.requestRenderAll();
    };

    const blockPointer = (e: PointerEvent) => {
      blocked.add(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.target !== upperCanvas) return;

      if (e.pointerType === "pen") {
        penDown = true;
        fingerPan = null;
        penDetectedRef.current();
        return; // Fabric draws
      }
      if (e.pointerType !== "touch") return;

      const now = performance.now();
      const isPalm =
        penDown ||
        now - lastPenUpAt < 300 ||
        (penOnlyRef.current && Math.max(e.width, e.height) > 40);
      if (isPalm) {
        blockPointer(e);
        return;
      }

      const p = toLocal(e);
      touches.set(e.pointerId, p);
      touchStarts.set(e.pointerId, p);

      if (touches.size === 1) {
        multiTap = { startedAt: now, fingers: 1, moved: false };
        gestureHadPinch = false;
        const tool = activeToolRef.current;
        if (penOnlyRef.current && (tool === "pen" || tool === "eraser")) {
          fingerPan = { id: e.pointerId, x: e.clientX, y: e.clientY };
          setShowOptions(false);
          blockPointer(e);
        }
        return; // otherwise Fabric handles the finger
      }

      if (multiTap) multiTap.fingers = Math.max(multiTap.fingers, touches.size);
      if (!isPinching) startPinch();
      blockPointer(e);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) {
        if (blocked.has(e.pointerId)) e.stopPropagation();
        return;
      }
      const p = toLocal(e);
      touches.set(e.pointerId, p);
      const start = touchStarts.get(e.pointerId);
      if (multiTap && start && Math.hypot(p.x - start.x, p.y - start.y) > 12) {
        multiTap.moved = true;
      }

      if (isPinching) {
        updatePinch();
        e.stopPropagation();
      } else if (fingerPan?.id === e.pointerId) {
        canvas.relativePan(
          new Point(e.clientX - fingerPan.x, e.clientY - fingerPan.y),
        );
        fingerPan.x = e.clientX;
        fingerPan.y = e.clientY;
        syncViewport();
        e.stopPropagation();
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType === "pen") {
        if (penDown) {
          penDown = false;
          lastPenUpAt = performance.now();
        }
        return;
      }
      const wasBlocked = blocked.delete(e.pointerId);
      if (touches.delete(e.pointerId)) {
        touchStarts.delete(e.pointerId);
        if (fingerPan?.id === e.pointerId) fingerPan = null;
        if (isPinching && touches.size < 2) endPinch();

        if (touches.size === 0 && multiTap) {
          const tap = multiTap;
          multiTap = null;
          const quick = performance.now() - tap.startedAt < 350;
          if (e.type === "pointerup" && quick && !tap.moved) {
            if (tap.fingers === 2) undoRef.current();
            else if (tap.fingers === 3) redoRef.current();
          }
        }
      }
      if (wasBlocked) e.stopPropagation();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);

    // Long-press on touch screens would open the context menu
    const preventContextMenu = (e: Event) => e.preventDefault();
    upperCanvas?.addEventListener("contextmenu", preventContextMenu);

    // Fix: on mobile/stylus, browser fires pointercancel instead of pointerup
    // which leaves Fabric's brush stuck "down", connecting the next stroke.
    const forceEndStroke = () => {
      const c = fabricRef.current;
      if (!c || !c.isDrawingMode) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cAny = c as any;
      if (cAny._isCurrentlyDrawing) {
        try {
          cAny.freeDrawingBrush?._finalizeAndAddPath?.();
        } catch {}
        cAny._isCurrentlyDrawing = false;
        c.renderAll();
      }
      setIsDrawing(false);
    };
    upperCanvas?.addEventListener("pointercancel", forceEndStroke);

    return () => {
      disposed = true;
      if (viewportRaf !== null) cancelAnimationFrame(viewportRaf);
      window.clearTimeout(initTimeout);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      canvas.off("path:created", handlePathCreated);
      canvas.off("object:added", onObjectAdded);
      canvas.off("object:removed", syncEmpty);
      canvas.off("object:modified", onObjectModified);
      canvas.off("selection:created", syncSelection);
      canvas.off("selection:updated", syncSelection);
      canvas.off("selection:cleared", syncSelection);
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      upperCanvas?.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerEnd, true);
      window.removeEventListener("pointercancel", onPointerEnd, true);
      upperCanvas?.removeEventListener("contextmenu", preventContextMenu);
      upperCanvas?.removeEventListener("pointercancel", forceEndStroke);
      canvas.dispose();
      fabricRef.current = null;
    };
    // The canvas is rebuilt only when switching notes; `draft` is read once
    // on load and other callbacks are stable or reached through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note]);

  const saveNotes = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || savingRef.current) return;

    // Don't lose text that's still being typed
    commitText();

    savingRef.current = true;
    setSaving(true);
    const uploadedPaths: string[] = [];

    try {
      // Keep selection handles out of the preview
      canvas.discardActiveObject();
      canvas.renderAll();

      const rawJSON = slimCanvasJSON(snapshotCanvas(canvas));
      rawJSON.viewportTransform = canvas.viewportTransform;

      let preview_image_url: string;

      if (hasCustomBg(canvas)) {
        // Custom background — single preview, no theme switching needed
        const dataUrl = canvas.toDataURL(PREVIEW_OPTIONS);
        const fileName = `${STORAGE_BUCKET}/${crypto.randomUUID()}.webp`;
        preview_image_url = await uploadPreviewImage(dataUrl, fileName);
        uploadedPaths.push(fileName);
      } else {
        // Theme-adaptive background — generate both light and dark previews
        const lightDataUrl = renderWithTheme(canvas, false);
        const darkDataUrl = renderWithTheme(canvas, true);
        // Restore current theme after renderWithTheme left originals but didn't re-render
        applyThemeToCanvas(canvas, isDarkRef.current);

        const previewUuid = crypto.randomUUID();
        const lightFileName = `${STORAGE_BUCKET}/${previewUuid}.webp`;
        const darkFileName = `${STORAGE_BUCKET}/${previewUuid}-dark.webp`;

        const [url] = await Promise.all([
          uploadPreviewImage(lightDataUrl, lightFileName).then((u) => {
            uploadedPaths.push(lightFileName);
            return u;
          }),
          uploadPreviewImage(darkDataUrl, darkFileName).then((u) => {
            uploadedPaths.push(darkFileName);
            return u;
          }),
        ]);
        preview_image_url = url;
      }

      const canvas_json = await compressJSON(rawJSON);
      const isUpdate = Boolean(note?.id);

      const { data, error } = isUpdate
        ? await supabase
            .from("borrower_notes")
            .update({
              canvas_json,
              preview_img_url: preview_image_url,
              updated_at: new Date().toISOString(),
            })
            .eq("id", note!.id!)
            .select()
            .single()
        : await supabase
            .from("borrower_notes")
            .insert({
              borrower_id: borrowerId,
              canvas_json,
              preview_img_url: preview_image_url,
              x: 40,
              y: 40,
            })
            .select()
            .single();

      if (error) {
        console.error(error);
        toast.error(isUpdate ? "Failed to update note" : "Failed to save note");
        // The new previews were never referenced — drop them
        await removeStoragePaths(uploadedPaths);
        return;
      }

      // Old previews are only removed once the row points at the new ones
      const oldUrl = note?.preview_img_url;
      await removeStoragePaths([
        storagePathFromUrl(oldUrl),
        storagePathFromUrl(oldUrl?.replace(/\.webp$/, "-dark.webp")),
      ]);

      setDirty(false);
      toast.success(isUpdate ? "Note updated" : "Note saved");
      onSaved?.(data);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while saving");
      await removeStoragePaths(uploadedPaths);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [borrowerId, note, onSaved, commitText]);

  const clearCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (canvas.getObjects().length === 0 && !hasCustomBg(canvas)) return;
    cancelText();
    canvas.clear();
    canvas.backgroundColor = getTheme(isDarkRef.current).bg;
    setCustomBg(canvas, false);
    canvas.renderAll();
    pushHistory();
    applyDrawingBrushRef.current();
    toast("Canvas cleared", {
      action: { label: "Undo", onClick: () => undo() },
    });
  }, [cancelText, pushHistory, undo]);

  const resetBackground = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !hasCustomBg(canvas)) return;
    setCustomBg(canvas, false);
    applyThemeToCanvas(canvas, isDarkRef.current);
    pushHistory();
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    const objects = canvas.getActiveObjects();
    if (objects.length === 0) return false;
    canvas.discardActiveObject();
    canvas.remove(...objects);
    canvas.requestRenderAll();
    pushHistory();
    return true;
  }, [pushHistory]);

  const setZoomAround = useCallback((next: number, point?: Point) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.zoomToPoint(
      point ?? new Point(canvas.getWidth() / 2, canvas.getHeight() / 2),
      clampZoom(next),
    );
    setViewport([...canvas.viewportTransform] as TMat2D);
  }, []);

  const zoomCanvas = useCallback(
    (factor: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      setZoomAround(canvas.getZoom() * factor);
    },
    [setZoomAround],
  );

  const resetZoom = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setViewport([...canvas.viewportTransform] as TMat2D);
  }, []);

  /** Zoom and center so every object is in view. */
  const fitToContent = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects().filter((o) => !isPaperPath(o));
    if (objects.length === 0) {
      resetZoom();
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const obj of objects) {
      const r = obj.getBoundingRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.left + r.width);
      maxY = Math.max(maxY, r.top + r.height);
    }
    const padding = 24;
    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const next = clampZoom(
      Math.min(
        (width - padding * 2) / contentW,
        (height - padding * 2) / contentH,
        2,
      ),
    );
    canvas.setViewportTransform([
      next,
      0,
      0,
      next,
      (width - contentW * next) / 2 - minX * next,
      (height - contentH * next) / 2 - minY * next,
    ]);
    setViewport([...canvas.viewportTransform] as TMat2D);
  }, [resetZoom]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        void saveNotes();
        return;
      }
      if (mod || e.altKey) return;

      if (key === "delete" || key === "backspace") {
        if (deleteSelected()) e.preventDefault();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat && spaceRestoreToolRef.current === null) {
          const current = activeToolRef.current;
          if (current !== "pan") {
            spaceRestoreToolRef.current = current;
            setActiveTool("pan");
          }
        }
        return;
      }
      if (e.code === "Digit0" && e.shiftKey) {
        fitToContent();
        return;
      }
      if (key === "=" || key === "+") {
        zoomCanvas(1.2);
        return;
      }
      if (key === "-") {
        zoomCanvas(1 / 1.2);
        return;
      }
      const tool = TOOL_BY_SHORTCUT[key];
      if (tool && !e.repeat) {
        spaceRestoreToolRef.current = null;
        setActiveTool(tool);
      }
    };
    const restoreFromSpace = () => {
      const restore = spaceRestoreToolRef.current;
      if (restore === null) return;
      spaceRestoreToolRef.current = null;
      setActiveTool(restore);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") restoreFromSpace();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", restoreFromSpace);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", restoreFromSpace);
    };
  }, [undo, redo, saveNotes, deleteSelected, zoomCanvas, fitToContent]);

  const selectTool = (tool: DrawTool) => {
    spaceRestoreToolRef.current = null;
    setActiveTool(tool);
  };

  /** Tapping the active tool again toggles its options. */
  const onToolPress = (tool: DrawTool) => {
    if (tool === activeTool) {
      setShowOptions((open) => !open);
    } else {
      selectTool(tool);
    }
  };

  const themeInk = isDark ? NOTES_DARK_INK : NOTES_LIGHT_INK;
  const activeColor = brushIsInk ? themeInk : brushColor;
  const isCustomColor =
    !brushIsInk && !PALETTE.includes(brushColor.toLowerCase());
  const showColors =
    activeTool === "pen" || activeTool === "bucket" || activeTool === "text";
  const activeToolMeta = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];
  const toolHint = TOOL_HINTS[activeTool];
  // Floating controls fade back while a stroke is in progress
  const floatingFade = cn(
    "transition-opacity duration-200",
    isDrawing && "opacity-25",
  );
  const swatchRing = `ring-2 ring-sky-500 ring-offset-2 ring-offset-white
    dark:ring-offset-slate-900`;

  const colorControls = (
    <div className="grid grid-cols-8 gap-2">
      <button
        type="button"
        onClick={() => setBrushIsInk(true)}
        aria-label="Ink (follows theme)"
        aria-pressed={brushIsInk}
        title="Ink — adapts to light / dark theme"
        className={cn(
          `aspect-square w-full max-w-8 touch-manipulation rounded-full border
          border-slate-300 transition dark:border-slate-600`,
          brushIsInk && swatchRing,
        )}
        style={{
          background: `linear-gradient(135deg, ${NOTES_LIGHT_INK} 50%, ${NOTES_DARK_INK} 50%)`,
        }}
      />
      {PALETTE.map((color) => {
        const selected = !brushIsInk && brushColor.toLowerCase() === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => {
              setBrushIsInk(false);
              setBrushColor(color);
            }}
            aria-label={`Color ${color}`}
            aria-pressed={selected}
            className={cn(
              `aspect-square w-full max-w-8 touch-manipulation rounded-full
              border border-black/10 transition active:scale-90`,
              selected && swatchRing,
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
      <label
        title="Custom color"
        className={cn(
          `relative aspect-square w-full max-w-8 cursor-pointer overflow-hidden
          rounded-full border border-black/10 transition active:scale-90`,
          isCustomColor && swatchRing,
        )}
        style={{
          background: isCustomColor
            ? brushColor
            : "conic-gradient(#ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)",
        }}
      >
        <span className="sr-only">Custom color</span>
        <input
          type="color"
          value={activeColor}
          onChange={(e) => {
            setBrushIsInk(false);
            setBrushColor(e.target.value);
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );

  const smallButton = `inline-flex h-9 touch-manipulation items-center gap-1.5
    rounded-lg border px-3 text-[11px] font-bold uppercase transition
    active:scale-95 disabled:pointer-events-none disabled:opacity-40`;

  const optionsPanel = (
    <div
      id="notes-tool-options"
      className={cn(
        `pointer-events-auto w-full max-w-sm animate-in rounded-2xl p-3
        duration-150 fade-in slide-in-from-bottom-2`,
        FLOATING_SURFACE,
      )}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span
          className="text-xs font-black text-slate-800 uppercase
            dark:text-slate-100"
        >
          {activeToolMeta.label}
        </span>
        {toolHint && (
          <span
            className="text-right text-[11px] leading-tight text-slate-400
              dark:text-slate-500"
          >
            {toolHint}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {showColors && colorControls}

        {activeTool === "pen" && (
          <>
            <SliderField
              label="Size"
              min={1}
              max={30}
              step={1}
              value={brushSize}
              display={`${brushSize}px`}
              onChange={setBrushSize}
            />
            <SliderField
              label="Opacity"
              min={0.1}
              max={1}
              step={0.1}
              value={brushOpacity}
              display={`${Math.round(brushOpacity * 100)}%`}
              onChange={setBrushOpacity}
            />
          </>
        )}

        {activeTool === "eraser" && (
          <SliderField
            label="Size"
            min={4}
            max={60}
            step={1}
            value={eraserSize}
            display={`${eraserSize}px`}
            onChange={setEraserSize}
          />
        )}

        {activeTool === "bucket" && (
          <>
            <SliderField
              label="Opacity"
              min={0.1}
              max={1}
              step={0.1}
              value={brushOpacity}
              display={`${Math.round(brushOpacity * 100)}%`}
              onChange={setBrushOpacity}
            />
            <button
              type="button"
              onClick={resetBackground}
              title="Reset background to paper color"
              className={cn(
                smallButton,
                `self-start border-slate-200 text-slate-600 hover:bg-slate-100
                dark:border-slate-700 dark:text-slate-300
                dark:hover:bg-slate-800`,
              )}
            >
              <RotateCcw className="size-3.5" />
              Reset background
            </button>
          </>
        )}

        {activeTool === "text" && (
          <OptionRow label="Size">
            <div className="flex items-center gap-1">
              <ToolbarButton
                label="Smaller text"
                onClick={() => setTextSize((s) => Math.max(10, s - 2))}
                disabled={textSize <= 10}
              >
                <Minus />
              </ToolbarButton>
              <span
                className="w-12 text-center text-sm font-bold text-slate-700
                  tabular-nums dark:text-slate-200"
              >
                {textSize}
              </span>
              <ToolbarButton
                label="Larger text"
                onClick={() => setTextSize((s) => Math.min(120, s + 2))}
                disabled={textSize >= 120}
              >
                <Plus />
              </ToolbarButton>
            </div>
          </OptionRow>
        )}

        {activeTool === "select" && (
          <button
            type="button"
            onClick={deleteSelected}
            disabled={!hasSelection}
            className={cn(
              smallButton,
              `self-start border-rose-200 bg-rose-50 text-rose-700
              hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950
              dark:text-rose-300`,
            )}
          >
            <Trash2 className="size-3.5" />
            Delete selected
          </button>
        )}

        {(activeTool === "pen" || activeTool === "eraser") && (
          <button
            type="button"
            role="switch"
            aria-checked={penOnly}
            onClick={() => setPenOnlyPref(!penOnly)}
            className="flex touch-manipulation items-center justify-between
              gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left
              transition hover:bg-slate-50 dark:border-slate-700
              dark:hover:bg-slate-800/60"
          >
            <span>
              <span
                className="block text-xs font-bold text-slate-700
                  dark:text-slate-200"
              >
                Pen only
              </span>
              <span className="block text-[11px] text-slate-400">
                Stylus draws · finger pans · palm ignored
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                penOnly
                  ? "bg-slate-900 dark:bg-slate-100"
                  : "bg-slate-300 dark:bg-slate-700",
              )}
            >
              <span
                className={cn(
                  `absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow
                  transition-transform dark:bg-slate-900`,
                  penOnly && "translate-x-4",
                )}
              />
            </span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1 sm:min-h-[480px]">
        <div className="absolute inset-0 overflow-hidden">
          <div
            ref={containerRef}
            onContextMenu={(e) => e.preventDefault()}
            className="relative h-full w-full overflow-hidden overscroll-contain
              rounded-xl border border-slate-300 select-none
              [-webkit-touch-callout:none] dark:border-slate-700"
            style={{
              backgroundColor: isDark ? NOTES_DARK_BG : NOTES_LIGHT_BG,
              touchAction: "none",
            }}
          >
            <canvas
              ref={canvasElRef}
              tabIndex={-1}
              className="block h-full w-full touch-none"
            />

            {ready && isEmpty && !textInput && (
              <div
                className="pointer-events-none absolute inset-0 flex
                  items-center justify-center p-8 text-center"
              >
                <p
                  className="text-sm font-medium text-slate-400
                    dark:text-stone-500"
                >
                  Blank note — start writing
                  <span className="mt-1 block text-xs opacity-80">
                    Pinch to zoom · two-finger tap to undo
                  </span>
                </p>
              </div>
            )}

            {textInput && (
              <div
                className="absolute z-30"
                style={{
                  left: textInput.x * viewport[0] + viewport[4],
                  top: textInput.y * viewport[3] + viewport[5],
                }}
              >
                <textarea
                  autoFocus
                  value={textInput.value}
                  wrap="off"
                  rows={Math.max(1, textInput.value.split("\n").length)}
                  cols={Math.max(
                    2,
                    ...textInput.value.split("\n").map((l) => l.length + 1),
                  )}
                  aria-label="Note text"
                  onChange={(e) =>
                    setTextEdit({ ...textInput, value: e.target.value })
                  }
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.shiftKey || e.ctrlKey || e.metaKey)
                    ) {
                      e.preventDefault();
                      commitText();
                    }
                  }}
                  className="block resize-none overflow-hidden bg-transparent
                    p-0 whitespace-pre outline-1 outline-offset-2
                    outline-sky-500 outline-dashed select-text
                    [field-sizing:content]"
                  style={{
                    color: textInput.color,
                    fontSize: `${textInput.fontSize * zoom}px`,
                    fontFamily: "sans-serif",
                    // Matches Fabric's line pitch (lineHeight × _fontSizeMult)
                    lineHeight: 1.16 * 1.13,
                    minWidth: "1ch",
                  }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={commitText}
                    className="h-8 touch-manipulation rounded-lg bg-sky-500 px-3
                      text-xs font-bold text-white shadow sm:hidden"
                  >
                    Done
                  </button>
                  <p
                    className="hidden rounded bg-slate-900/80 px-1.5 py-0.5
                      text-[10px] whitespace-nowrap text-white sm:block"
                  >
                    Ctrl+Enter to finish · Esc to cancel
                  </p>
                </div>
              </div>
            )}

            {/* Top-left: history + zoom */}
            <div
              className={cn(
                `absolute top-2 left-2 z-20 flex items-center gap-0.5
                rounded-2xl p-1`,
                FLOATING_SURFACE,
                floatingFade,
              )}
            >
              <ToolbarButton
                label="Undo"
                shortcut="Ctrl+Z · two-finger tap"
                onClick={undo}
                disabled={!history.canUndo}
              >
                <Undo2 />
              </ToolbarButton>
              <ToolbarButton
                label="Redo"
                shortcut="Ctrl+Shift+Z · three-finger tap"
                onClick={redo}
                disabled={!history.canRedo}
              >
                <Redo2 />
              </ToolbarButton>
              <DockDivider />
              <ToolbarButton
                label="Zoom out"
                shortcut="-"
                onClick={() => zoomCanvas(1 / 1.2)}
                disabled={zoom <= MIN_ZOOM}
                className="max-sm:hidden"
              >
                <ZoomOut />
              </ToolbarButton>
              <button
                type="button"
                onClick={() =>
                  Math.abs(zoom - 1) < 0.01 ? fitToContent() : resetZoom()
                }
                title={
                  Math.abs(zoom - 1) < 0.01
                    ? "Fit to content"
                    : "Reset zoom to 100%"
                }
                className="h-10 min-w-12 touch-manipulation rounded-xl px-1.5
                  text-[11px] font-bold text-slate-600 tabular-nums transition
                  hover:bg-slate-100 active:scale-95 sm:h-9 sm:rounded-lg
                  dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {Math.round(zoom * 100)}%
              </button>
              <ToolbarButton
                label="Zoom in"
                shortcut="+"
                onClick={() => zoomCanvas(1.2)}
                disabled={zoom >= MAX_ZOOM}
                className="max-sm:hidden"
              >
                <ZoomIn />
              </ToolbarButton>
              <ToolbarButton
                label="Fit to content"
                shortcut="Shift+0"
                onClick={fitToContent}
                className="max-sm:hidden"
              >
                <Scan />
              </ToolbarButton>
            </div>

            {/* Top-right: clear + save */}
            <div
              className={cn(
                "absolute top-2 right-2 z-20 flex items-center gap-1.5",
                floatingFade,
              )}
            >
              {dirty && (
                <span
                  className="size-2 rounded-full bg-amber-500 ring-2 ring-white
                    dark:ring-slate-900"
                  title="Unsaved changes"
                >
                  <span className="sr-only">Unsaved changes</span>
                </span>
              )}
              <button
                type="button"
                onClick={clearCanvas}
                disabled={saving || (isEmpty && !dirty)}
                title="Clear canvas"
                className="h-10 touch-manipulation rounded-xl border
                  border-slate-400 bg-rose-100 px-3 text-xs font-bold
                  text-rose-800 uppercase shadow-sm transition active:scale-95
                  disabled:pointer-events-none disabled:opacity-50 sm:h-9
                  sm:rounded-lg sm:hover:translate-x-0.5
                  sm:hover:-translate-y-0.5"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveNotes();
                }}
                disabled={saving}
                title="Save (Ctrl+S)"
                className="inline-flex h-10 touch-manipulation items-center
                  gap-1.5 rounded-xl border border-slate-400 bg-emerald-200 px-3
                  text-xs font-bold text-slate-700 uppercase shadow-sm
                  transition active:scale-95 disabled:pointer-events-none
                  disabled:opacity-60 sm:h-9 sm:rounded-lg
                  sm:hover:translate-x-0.5 sm:hover:-translate-y-0.5"
              >
                {saving && <LoaderCircle className="size-3.5 animate-spin" />}
                {saving ? "Saving" : "Save"}
              </button>
            </div>

            {/* Bottom dock: tool options + tools */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20
                flex flex-col items-center gap-2 p-2"
            >
              {showOptions && optionsPanel}

              <div
                role="toolbar"
                aria-label="Drawing tools"
                className={cn(
                  `pointer-events-auto flex max-w-full items-center gap-0.5
                  overflow-x-auto rounded-2xl p-1 [scrollbar-width:none]`,
                  FLOATING_SURFACE,
                  floatingFade,
                )}
              >
                {TOOLS.map(({ id, label, shortcut, icon: Icon }) => (
                  <ToolbarButton
                    key={id}
                    label={label}
                    shortcut={shortcut}
                    active={activeTool === id}
                    onClick={() => onToolPress(id)}
                  >
                    <Icon />
                  </ToolbarButton>
                ))}
                <DockDivider />
                <ToolbarButton
                  label={showOptions ? "Hide tool options" : "Tool options"}
                  onClick={() => setShowOptions((open) => !open)}
                  aria-expanded={showOptions}
                  aria-controls="notes-tool-options"
                  className={cn(
                    showOptions && "bg-slate-100 dark:bg-slate-800",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-6 items-center justify-center
                      rounded-full border-2 border-slate-300
                      dark:border-slate-600"
                  >
                    <span
                      className="rounded-full"
                      style={{
                        width:
                          activeTool === "eraser"
                            ? 12
                            : Math.max(6, Math.min(brushSize + 4, 14)),
                        height:
                          activeTool === "eraser"
                            ? 12
                            : Math.max(6, Math.min(brushSize + 4, 14)),
                        backgroundColor:
                          activeTool === "eraser"
                            ? isDark
                              ? NOTES_DARK_BG
                              : NOTES_LIGHT_BG
                            : activeColor,
                        opacity: activeTool === "pen" ? brushOpacity : 1,
                        boxShadow:
                          activeTool === "eraser"
                            ? "inset 0 0 0 1.5px currentColor"
                            : undefined,
                      }}
                    />
                  </span>
                </ToolbarButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
