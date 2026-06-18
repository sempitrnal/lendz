"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Canvas,
  PencilBrush,
  Point,
  Text,
  type Path,
  type Canvas as FabricCanvas,
} from "fabric";
import { supabase } from "@/lib/supabase/client";
import {
  Undo2,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Pencil,
  Eraser,
  MousePointer2,
  Type,
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

function getTheme(dark: boolean) {
  return dark
    ? { bg: NOTES_DARK_BG, ink: NOTES_DARK_INK }
    : { bg: NOTES_LIGHT_BG, ink: NOTES_LIGHT_INK };
}

/**
 * Walk all canvas objects and map sentinel `data` values to the
 * resolved colors for `dark`.  Background is also updated.
 */
function applyThemeToCanvas(canvas: FabricCanvas, dark: boolean) {
  const { bg, ink } = getTheme(dark);
  canvas.backgroundColor = bg;
  for (const obj of canvas.getObjects()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = ((obj as any).data as Record<string, string>) ?? {};
    if (d.logicalStroke === INK_SENTINEL) obj.set("stroke", ink);
    else if (d.logicalStroke === PAPER_SENTINEL) obj.set("stroke", bg);
    if (d.logicalFill === INK_SENTINEL) obj.set("fill", ink);
  }
  canvas.renderAll();
}

/**
 * Temporarily apply a theme, capture a dataURL, then restore original
 * per-object colors and background.  Does NOT call renderAll at the end
 * — the caller must do that if they need to display the canvas again.
 */
function renderWithTheme(canvas: FabricCanvas, dark: boolean): string {
  const { bg, ink } = getTheme(dark);
  const origBg = canvas.backgroundColor as string;
  const objects = canvas.getObjects();
  const origColors = objects.map((obj) => ({
    stroke: obj.stroke as string | null | undefined,
    fill: obj.fill as string | null | undefined,
  }));

  canvas.backgroundColor = bg;
  for (const obj of objects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = ((obj as any).data as Record<string, string>) ?? {};
    if (d.logicalStroke === INK_SENTINEL) obj.set("stroke", ink);
    else if (d.logicalStroke === PAPER_SENTINEL) obj.set("stroke", bg);
    if (d.logicalFill === INK_SENTINEL) obj.set("fill", ink);
  }
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({
    format: "webp",
    quality: 0.85,
    multiplier: 2,
    enableRetinaScaling: true,
  });

  // Restore
  canvas.backgroundColor = origBg;
  objects.forEach((obj, i) => {
    obj.set("stroke", origColors[i].stroke as string);
    obj.set("fill", origColors[i].fill as string);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (obj as any).data = rawData;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = ((obj as any).data ?? {}) as Record<string, string>;
    if (existing.logicalStroke || existing.logicalFill) continue;

    const stroke = obj.stroke as string | null | undefined;
    const fill = obj.fill as string | null | undefined;
    const data: Record<string, string | null> = { ...existing };

    if (stroke === NOTES_LIGHT_INK || stroke === NOTES_DARK_INK) {
      data.logicalStroke = INK_SENTINEL;
    } else if (stroke === NOTES_LIGHT_BG || stroke === NOTES_DARK_BG) {
      data.logicalStroke = PAPER_SENTINEL;
    }
    if (fill === NOTES_LIGHT_INK || fill === NOTES_DARK_INK) {
      data.logicalFill = INK_SENTINEL;
    }

    if (data.logicalStroke || data.logicalFill) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (obj as any).data = data;
    }
  }
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

function paperStrokeColor(canvas: FabricCanvas): string {
  const bg = canvas.backgroundColor;
  return typeof bg === "string" && bg.length > 0 ? bg : NOTES_LIGHT_BG;
}

function canvasToScreenPoint(canvas: FabricCanvas, x: number, y: number) {
  const vpt = canvas.viewportTransform as number[];
  return {
    x: vpt[0] * x + vpt[2] * y + vpt[4],
    y: vpt[1] * x + vpt[3] * y + vpt[5],
  };
}

function findTextAtPointer(
  canvas: FabricCanvas,
  pointer: { x: number; y: number },
) {
  const objects = canvas.getObjects();
  const pt = new Point(pointer.x, pointer.y);
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.type === "text" && obj.containsPoint(pt)) {
      return obj as Text;
    }
  }
  return null;
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
  onSaved?: (note: BorrowerNotePayload) => void;
};

type DrawTool = "pen" | "eraser" | "select" | "pan" | "text";

class EraserPencilBrush extends PencilBrush {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { logicalStroke: PAPER_SENTINEL },
    } as any);
    return path;
  }
}

const ERASER_WIDTH = 14;
const PEN_WIDTH = 2;

export default function NotesCanvas({
  borrowerId,
  note,
  onSaved,
}: NotesCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [showTools, setShowTools] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [brushIsInk, setBrushIsInk] = useState(true);
  const [brushColor, setBrushColor] = useState(NOTES_LIGHT_INK);
  const [textSize, setTextSize] = useState(24);
  const [activeTool, setActiveTool] = useState<DrawTool>("pen");

  const isDarkRef = useRef(false);
  const brushIsInkRef = useRef(true);
  const [textInput, setTextInput] = useState<{
    canvasX: number;
    canvasY: number;
    value: string;
    targetId?: string;
  } | null>(null);

  const historyRef = useRef<Record<string, unknown>[]>([]);
  const historyIndexRef = useRef(-1);
  const maxHistory = 50;
  const [historyVersion, setHistoryVersion] = useState(0);

  const pushHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = (canvas as any).toJSON(["data"]) as Record<string, unknown>;
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
    setHistoryVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const json = historyRef.current[historyIndexRef.current];
    canvas.clear();
    canvas.loadFromJSON(json).then(() => {
      restoreObjectData(canvas, json);
      tagLegacyObjects(canvas);
      applyThemeToCanvas(canvas, isDarkRef.current);
      applyDrawingBrushRef.current();
      setHistoryVersion((v) => v + 1);
    });
  }, []);

  const redo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const json = historyRef.current[historyIndexRef.current];
    canvas.clear();
    canvas.loadFromJSON(json).then(() => {
      restoreObjectData(canvas, json);
      tagLegacyObjects(canvas);
      applyThemeToCanvas(canvas, isDarkRef.current);
      applyDrawingBrushRef.current();
      setHistoryVersion((v) => v + 1);
    });
  }, []);

  const startTextEdit = useCallback(
    (canvasX: number, canvasY: number, target?: Text) => {
      setTextInput({
        canvasX,
        canvasY,
        value: target?.text ?? "",
        targetId: target ? (target as unknown as { id: string }).id : undefined,
      });
    },
    [],
  );

  const commitText = useCallback(
    (value: string) => {
      const canvas = fabricRef.current;
      if (!canvas || !textInput) return;

      const { canvasX, canvasY, targetId } = textInput;
      let nextId = crypto.randomUUID();

      if (targetId) {
        const target = canvas
          .getObjects()
          .find((o) => (o as unknown as { id: string }).id === targetId);
        if (target) {
          canvas.remove(target);
          nextId = targetId;
        }
      }

      if (value.trim()) {
        const resolvedFill = brushIsInkRef.current
          ? getTheme(isDarkRef.current).ink
          : brushColor;
        const text = new Text(value, {
          left: canvasX,
          top: canvasY,
          fontSize: textSize,
          fill: resolvedFill,
          fontFamily: "sans-serif",
          selectable: true,
          evented: true,
        });
        (text as unknown as { id: string }).id = nextId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (text as any).data = {
          logicalFill: brushIsInkRef.current ? INK_SENTINEL : null,
        };
        canvas.add(text);
        canvas.setActiveObject(text);
      }

      canvas.renderAll();
      pushHistory();
      setTextInput(null);
    },
    [textInput, textSize, brushColor, pushHistory],
  );

  const cancelText = useCallback(() => {
    setTextInput(null);
  }, []);

  const applyDrawingBrush = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (activeTool === "select" || activeTool === "text") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = activeTool === "text" ? "text" : "default";
      return;
    }

    if (activeTool === "pan") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "grab";
      return;
    }

    canvas.isDrawingMode = true;
    canvas.defaultCursor = "crosshair";

    if (activeTool === "eraser") {
      const brush = new EraserPencilBrush(canvas);
      brush.width = ERASER_WIDTH;
      brush.color = "#000000";
      canvas.freeDrawingBrush = brush;
    } else {
      const brush = new PencilBrush(canvas);
      brush.width = PEN_WIDTH;
      brush.color = brushIsInkRef.current
        ? getTheme(isDarkRef.current).ink
        : brushColor;
      canvas.freeDrawingBrush = brush;
    }
  }, [activeTool, brushColor]);

  const activeToolRef = useRef<DrawTool>(activeTool);

  const applyDrawingBrushRef = useRef(applyDrawingBrush);

  useEffect(() => {
    applyDrawingBrushRef.current = applyDrawingBrush;
    activeToolRef.current = activeTool;
  }, [applyDrawingBrush, activeTool]);

  // Sync mutable refs so canvas-init closures always see latest values
  useEffect(() => {
    isDarkRef.current = isDark;
    brushIsInkRef.current = brushIsInk;
  }, [isDark, brushIsInk]);

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

  // Re-apply theme whenever dark mode changes; also refresh the brush color
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    applyThemeToCanvas(canvas, isDark);
    applyDrawingBrushRef.current();
  }, [isDark]);

  // Re-apply brush when ink toggle changes
  useEffect(() => {
    applyDrawingBrushRef.current();
  }, [brushIsInk]);

  // initialize canvas
  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      backgroundColor: NOTES_LIGHT_BG,
      isDrawingMode: true,
      preserveObjectStacking: true,
    });
    const upperCanvas = canvas.upperCanvasEl;

    if (upperCanvas) {
      upperCanvas.tabIndex = -1;
    }
    upperCanvas?.blur();
    fabricRef.current = canvas;

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

    let disposed = false;

    // load saved JSON (supports both compressed and legacy uncompressed)
    const loadCanvas = async () => {
      if (note?.canvas_json) {
        try {
          let jsonData: unknown = note.canvas_json;
          if (isCompressed(jsonData)) {
            jsonData = await decompressJSON(jsonData);
          }

          if (disposed) return;

          canvas.clear();
          await canvas.loadFromJSON(jsonData as Record<string, unknown>);

          restoreObjectData(canvas, jsonData as Record<string, unknown>);
          tagLegacyObjects(canvas);
          applyThemeToCanvas(canvas, isDarkRef.current);

          const vpt = (jsonData as Record<string, unknown>).viewportTransform;
          if (Array.isArray(vpt) && vpt.length === 6) {
            canvas.viewportTransform = vpt as [
              number,
              number,
              number,
              number,
              number,
              number,
            ];
          }

          canvas.renderAll();
          setZoom(canvas.getZoom());
        } catch (err) {
          console.error("Failed to load canvas JSON", err);
        }
      }

      if (!disposed) applyDrawingBrushRef.current();

      // seed initial history after load
      requestAnimationFrame(() => {
        if (disposed) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const initialJSON = (canvas as any).toJSON(["data"]) as Record<
          string,
          unknown
        >;
        historyRef.current = [initialJSON];
        historyIndexRef.current = 0;
      });
    };
    void loadCanvas();

    // Push state on every completed stroke; tag ink paths with INK_SENTINEL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlePathCreated = (opt: any) => {
      if (opt.path && activeToolRef.current !== "eraser") {
        const logicalStroke = brushIsInkRef.current ? INK_SENTINEL : null;
        opt.path.data = { logicalStroke };
        // Ensure resolved color matches current theme
        if (logicalStroke === INK_SENTINEL) {
          opt.path.set("stroke", getTheme(isDarkRef.current).ink);
        }
      }
      pushHistory();
    };
    canvas.on("path:created", handlePathCreated);

    // Pan tool — drag to move viewport
    let isPanning = false;
    let panLastX = 0;
    let panLastY = 0;
    const getPoint = (e: MouseEvent | TouchEvent) =>
      "touches" in e && e.touches.length > 0
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

    const onPanStart = (opt: { e: MouseEvent | TouchEvent }) => {
      if (activeToolRef.current !== "pan") return;
      isPanning = true;
      const p = getPoint(opt.e);
      panLastX = p.x;
      panLastY = p.y;
      canvas.defaultCursor = "grabbing";
    };
    const onPanMove = (opt: { e: MouseEvent | TouchEvent }) => {
      if (!isPanning || activeToolRef.current !== "pan") return;
      const p = getPoint(opt.e);
      const dx = p.x - panLastX;
      const dy = p.y - panLastY;
      const vpt = canvas.viewportTransform as number[];
      vpt[4] += dx;
      vpt[5] += dy;
      canvas.requestRenderAll();
      panLastX = p.x;
      panLastY = p.y;
    };
    const onPanEnd = () => {
      isPanning = false;
      if (activeToolRef.current === "pan") canvas.defaultCursor = "grab";
    };
    canvas.on("mouse:down", onPanStart as any);
    canvas.on("mouse:move", onPanMove as any);
    canvas.on("mouse:up", onPanEnd);

    // Text tool — double-click to create or edit text
    const onDblClick = (opt: {
      e: Event;
      pointer?: { x: number; y: number };
      scenePoint?: { x: number; y: number };
    }) => {
      if (activeToolRef.current !== "text") return;
      const pointer = opt.pointer ?? opt.scenePoint ?? { x: 0, y: 0 };
      const target = findTextAtPointer(canvas, pointer);
      if (target) {
        startTextEdit(
          target.left ?? pointer.x,
          target.top ?? pointer.y,
          target,
        );
      } else {
        startTextEdit(pointer.x, pointer.y);
      }
    };
    canvas.on("mouse:dblclick", onDblClick);

    // Text tool — double-tap on touch devices (mobile has no dblclick)
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    const onTouchEnd = (e: TouchEvent) => {
      if (activeToolRef.current !== "text") return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const now = Date.now();
      const dx = touch.clientX - lastTapX;
      const dy = touch.clientY - lastTapY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (now - lastTapTime < 350 && dist < 30) {
        // Double-tap: convert screen coords → canvas scene coords
        const rect = (
          canvas.upperCanvasEl ?? canvas.lowerCanvasEl
        ).getBoundingClientRect();
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const vpt = canvas.viewportTransform as number[];
        const canvasX = (screenX - vpt[4]) / vpt[0];
        const canvasY = (screenY - vpt[5]) / vpt[3];
        const pointer = { x: canvasX, y: canvasY };
        const target = findTextAtPointer(canvas, pointer);
        if (target) {
          startTextEdit(target.left ?? canvasX, target.top ?? canvasY, target);
        } else {
          startTextEdit(canvasX, canvasY);
        }
        lastTapTime = 0;
        e.preventDefault();
      } else {
        lastTapTime = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
      }
    };
    upperCanvas?.addEventListener("touchend", onTouchEnd, { passive: false });

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
    };
    upperCanvas?.addEventListener("pointercancel", forceEndStroke);
    upperCanvas?.addEventListener("touchcancel", forceEndStroke);

    // Undo / redo via keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      disposed = true;
      window.clearTimeout(initTimeout);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.off("path:created", handlePathCreated);
      canvas.off("mouse:down", onPanStart as any);
      canvas.off("mouse:move", onPanMove as any);
      canvas.off("mouse:up", onPanEnd);
      canvas.off("mouse:dblclick", onDblClick);
      upperCanvas?.removeEventListener("touchend", onTouchEnd);
      upperCanvas?.removeEventListener("pointercancel", forceEndStroke);
      upperCanvas?.removeEventListener("touchcancel", forceEndStroke);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [note]);

  useEffect(() => {
    applyDrawingBrush();
  }, [applyDrawingBrush]);
  async function uploadPreviewImage(
    dataUrl: string,
    fileName: string,
    oldUrl?: string | null,
  ) {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    const { error } = await supabase.storage
      .from("borrower-notes")
      .upload(fileName, buffer, { contentType: "image/webp" });

    if (error) throw error;

    if (oldUrl) {
      const marker = "/object/public/borrower-notes/";
      const oldPath = oldUrl.split(marker)[1];
      if (oldPath) {
        await supabase.storage.from("borrower-notes").remove([oldPath]);
      }
    }

    const { data } = supabase.storage
      .from("borrower-notes")
      .getPublicUrl(fileName);
    return data.publicUrl;
  }
  const saveNotes = useCallback(async () => {
    if (!fabricRef.current) return;

    try {
      setSaving(true);

      const canvas = fabricRef.current;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawJSON = (canvas as any).toJSON(["data"]) as Record<
        string,
        unknown
      >;
      if (Array.isArray(rawJSON.objects)) {
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
            } = obj as Record<string, unknown>;
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
            if (strokeLineJoin !== undefined)
              slim.strokeLineJoin = strokeLineJoin;
            if (opacity !== undefined && opacity !== 1) slim.opacity = opacity;
            return slim;
          },
        );
      }
      rawJSON.viewportTransform = canvas.viewportTransform;

      // Generate light + dark previews; share a UUID so dark URL is derivable
      const lightDataUrl = renderWithTheme(canvas, false);
      const darkDataUrl = renderWithTheme(canvas, true);
      // Restore current theme after renderWithTheme left originals but didn't re-render
      applyThemeToCanvas(canvas, isDarkRef.current);

      const previewUuid = crypto.randomUUID();
      const lightFileName = `borrower-notes/${previewUuid}.webp`;
      const darkFileName = `borrower-notes/${previewUuid}-dark.webp`;
      const oldDarkUrl =
        note?.preview_img_url?.replace(/\.webp$/, "-dark.webp") ?? null;

      const [preview_image_url] = await Promise.all([
        uploadPreviewImage(lightDataUrl, lightFileName, note?.preview_img_url),
        uploadPreviewImage(darkDataUrl, darkFileName, oldDarkUrl),
      ]);

      const canvas_json = await compressJSON(rawJSON);
      // UPDATE EXISTING NOTE
      if (note?.id) {
        const { data, error } = await supabase
          .from("borrower_notes")
          .update({
            canvas_json,
            preview_img_url: preview_image_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", note.id)
          .select()
          .single();

        if (error) {
          console.error(error);
          toast.error("Failed to update note");
          return;
        }

        toast.success("Note updated");
        onSaved?.(data);

        return;
      }

      // CREATE NEW NOTE
      const { data, error } = await supabase
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
        toast.error("Failed to save note");
        return;
      }

      toast.success("Note saved");
      onSaved?.(data);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while saving");
    } finally {
      setSaving(false);
    }
  }, [borrowerId, note, onSaved]);

  const clearCanvas = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = getTheme(isDarkRef.current).bg;
    canvas.renderAll();
    pushHistory();
    applyDrawingBrushRef.current();
  };

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const [zoom, setZoom] = useState(1);

  const zoomCanvas = useCallback((factor: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const next = Math.min(Math.max(canvas.getZoom() * factor, 0.1), 10);
    canvas.zoomToPoint(
      new Point(canvas.getWidth() / 2, canvas.getHeight() / 2),
      next,
    );
    setZoom(next);
  }, []);

  const resetZoom = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Persistent top bar — save / clear / hide always showing */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl
          border-2 border-slate-900 bg-white p-2
          shadow-[3px_3px_0px_0px_#0f172a]"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void saveNotes();
            }}
            disabled={saving}
            className="rounded-md border-2 border-slate-900 bg-emerald-200 px-3
              py-1 text-xs font-bold text-slate-600 uppercase
              shadow-[2px_2px_0px_0px_#0f172a] transition hover:translate-x-0.5
              hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            onClick={clearCanvas}
            className="rounded-md border-2 border-slate-900 bg-rose-100 px-3
              py-1 text-xs font-bold text-rose-800 uppercase
              shadow-[2px_2px_0px_0px_#0f172a] transition hover:translate-x-0.5
              hover:-translate-y-0.5"
          >
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowTools((p) => !p)}
          className="rounded-md border-2 border-slate-900 bg-slate-900 px-2.5
            py-1 text-xs font-bold text-white uppercase
            shadow-[2px_2px_0px_0px_#0f172a] transition hover:translate-x-0.5
            hover:-translate-y-0.5"
        >
          {showTools ? "Hide tools" : "Show tools"}
        </button>
      </div>

      {/* Canvas with floating tools */}
      <div className="relative min-h-0 flex-1 sm:min-h-[480px]">
        {/* Drawing toolbar — floats over the canvas */}
        {showTools && (
          <div
            className="absolute top-[2px] left-2 z-20 flex flex-wrap
              items-center gap-1.5 rounded-xl border-2 border-slate-900
              bg-white/95 p-1.5 shadow-[3px_3px_0px_0px_#0f172a]
              backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setActiveTool("pen")}
              className={`rounded-md border-2 border-slate-900 px-2 py-1
              text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a]
              transition hover:translate-x-0.5 hover:-translate-y-0.5 ${
                activeTool === "pen"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              <Pencil className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("eraser")}
              className={`rounded-md border-2 border-slate-900 px-2 py-1
              text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a]
              transition hover:translate-x-0.5 hover:-translate-y-0.5 ${
                activeTool === "eraser"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              <Eraser className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("pan")}
              title="Pan / scroll canvas"
              className={`rounded-md border-2 border-slate-900 px-2 py-1
              text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a]
              transition hover:translate-x-0.5 hover:-translate-y-0.5 ${
                activeTool === "pan"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              <Hand className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("select")}
              className={`rounded-md border-2 border-slate-900 px-2 py-1
              text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a]
              transition hover:translate-x-0.5 hover:-translate-y-0.5 ${
                activeTool === "select"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              <MousePointer2 className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("text")}
              className={`rounded-md border-2 border-slate-900 px-2 py-1
              text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a]
              transition hover:translate-x-0.5 hover:-translate-y-0.5 ${
                activeTool === "text"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600"
              }`}
            >
              <Type className="size-3.5" />
            </button>

            {activeTool === "text" && (
              <label className="flex items-center gap-1">
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  title="Text size"
                  className="h-6 w-12 rounded border-2 border-slate-300 bg-white
                    px-1 text-[10px] font-bold text-slate-600"
                />
              </label>
            )}

            {(activeTool === "pen" || activeTool === "text") && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBrushIsInk(true)}
                  title="Use adaptive ink color (follows theme)"
                  className={`h-6 rounded border-2 border-slate-900 px-1.5
                  text-[9px] font-black uppercase
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:translate-x-0.5 hover:-translate-y-0.5 ${
                    brushIsInk
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500"
                  }`}
                >
                  Ink
                </button>
                <input
                  type="color"
                  value={
                    brushIsInk
                      ? isDark
                        ? NOTES_DARK_INK
                        : NOTES_LIGHT_INK
                      : brushColor
                  }
                  onChange={(e) => {
                    setBrushIsInk(false);
                    setBrushColor(e.target.value);
                  }}
                  title="Custom color (disables auto-ink)"
                  className="h-6 w-8 cursor-pointer rounded border-2
                    border-slate-300 bg-white p-0.5"
                />
              </div>
            )}

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => zoomCanvas(1 / 1.2)}
                title="Zoom out"
                className="rounded-md border-2 border-slate-900 bg-white p-1
                  text-slate-600 shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:translate-x-0.5 hover:-translate-y-0.5"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                title="Reset zoom"
                className="rounded-md border-2 border-slate-900 bg-white px-1.5
                  py-1 text-[9px] font-black text-slate-600 tabular-nums
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:translate-x-0.5 hover:-translate-y-0.5"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => zoomCanvas(1.2)}
                title="Zoom in"
                className="rounded-md border-2 border-slate-900 bg-white p-1
                  text-slate-600 shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:translate-x-0.5 hover:-translate-y-0.5"
              >
                <ZoomIn className="size-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="rounded-md border-2 border-slate-900 bg-white p-1
                text-slate-600 shadow-[2px_2px_0px_0px_#0f172a] transition
                hover:translate-x-0.5 hover:-translate-y-0.5 disabled:opacity-40
                disabled:shadow-none"
            >
              <Undo2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="rounded-md border-2 border-slate-900 bg-white p-1
                text-slate-600 shadow-[2px_2px_0px_0px_#0f172a] transition
                hover:translate-x-0.5 hover:-translate-y-0.5 disabled:opacity-40
                disabled:shadow-none"
            >
              <Undo2 className="size-3.5 -scale-x-100" />
            </button>
          </div>
        )}

        <div
          className="absolute inset-0 flex items-center justify-center
            overflow-hidden"
        >
          <div
            ref={containerRef}
            className="relative aspect-9/16 max-h-full w-full max-w-full
              overflow-hidden rounded-xl border-2 border-slate-900
              shadow-[3px_3px_0px_0px_#0f172a]"
            style={{
              backgroundColor: isDark ? NOTES_DARK_BG : NOTES_LIGHT_BG,
              touchAction: "none",
            }}
          >
            <canvas
              ref={canvasElRef}
              tabIndex={-1}
              className="block h-full w-full"
            />

            {textInput &&
              fabricRef.current &&
              (() => {
                const { x: screenX, y: screenY } = canvasToScreenPoint(
                  fabricRef.current,
                  textInput.canvasX,
                  textInput.canvasY,
                );
                return (
                  <textarea
                    autoFocus
                    value={textInput.value}
                    rows={Math.max(1, textInput.value.split("\n").length)}
                    onChange={(e) =>
                      setTextInput({ ...textInput, value: e.target.value })
                    }
                    onBlur={() => commitText(textInput.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        (e.shiftKey || e.ctrlKey || e.metaKey)
                      ) {
                        e.preventDefault();
                        commitText(textInput.value);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelText();
                      }
                    }}
                    style={{
                      position: "absolute",
                      left: `${screenX}px`,
                      top: `${screenY}px`,
                      color: brushIsInk
                        ? isDark
                          ? NOTES_DARK_INK
                          : NOTES_LIGHT_INK
                        : brushColor,
                      fontSize: `${textSize}px`,
                      fontFamily: "sans-serif",
                      background: "transparent",
                      border: "1px dashed #0ea5e9",
                      outline: "none",
                      padding: 0,
                      minWidth: "4rem",
                      resize: "none",
                      overflow: "hidden",
                      lineHeight: 1.2,
                      zIndex: 10,
                    }}
                  />
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
}
