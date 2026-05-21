"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, PencilBrush, type Path, type Canvas as FabricCanvas } from "fabric";
import { supabase } from "@/lib/supabase/client";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

/** Keep in sync with Canvas `backgroundColor` and wrapper fill. */
const NOTES_CANVAS_PAPER = "#fffdf5";

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
    return typeof bg === "string" && bg.length > 0 ? bg : NOTES_CANVAS_PAPER;
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

type DrawTool = "pen" | "eraser" | "select";

/**
 * Live stroke uses the upper canvas only — we paint the paper color there.
 * Committed stroke uses the same opaque paper color (`source-over`) so the bitmap
 * matches the canvas; `destination-out` left transparent pixels that showed the
 * white panel behind the canvas after mouseup.
 */
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
        pathData: Parameters<PencilBrush["createPath"]>[0]
    ): Path {
        const path = super.createPath(pathData);
        path.set({
            stroke: paperStrokeColor(this.canvas),
            globalCompositeOperation: "source-over",
        });
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
    const [brushColor, setBrushColor] = useState("#111111");
    const [activeTool, setActiveTool] = useState<DrawTool>("pen");

    const historyRef = useRef<Record<string, unknown>[]>([]);
    const historyIndexRef = useRef(-1);
    const maxHistory = 50;
    const [historyVersion, setHistoryVersion] = useState(0);

    const pushHistory = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const json = canvas.toJSON() as Record<string, unknown>;
        // Remove entries ahead if we're not at the top
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
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
            canvas.backgroundColor = NOTES_CANVAS_PAPER;
            canvas.renderAll();
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
            canvas.backgroundColor = NOTES_CANVAS_PAPER;
            canvas.renderAll();
            applyDrawingBrushRef.current();
            setHistoryVersion((v) => v + 1);
        });
    }, []);

    const applyDrawingBrush = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        if (activeTool === "select") {
            canvas.isDrawingMode = false;
            return;
        }

        canvas.isDrawingMode = true;

        if (activeTool === "eraser") {
            const brush = new EraserPencilBrush(canvas);
            brush.width = ERASER_WIDTH;
            brush.color = "#000000";
            canvas.freeDrawingBrush = brush;
        } else {
            const brush = new PencilBrush(canvas);
            brush.width = PEN_WIDTH;
            brush.color = brushColor;
            canvas.freeDrawingBrush = brush;
        }
    }, [activeTool, brushColor]);

    const applyDrawingBrushRef = useRef(applyDrawingBrush);

    useEffect(() => {
        applyDrawingBrushRef.current = applyDrawingBrush;
    }, [applyDrawingBrush]);

    // initialize canvas
    useEffect(() => {
        if (!canvasElRef.current) return;

        const canvas = new Canvas(canvasElRef.current, {
            backgroundColor: NOTES_CANVAS_PAPER,
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

                    canvas.backgroundColor = NOTES_CANVAS_PAPER;

                    canvas.renderAll();
                } catch (err) {
                    console.error("Failed to load canvas JSON", err);
                }
            }

            if (!disposed) applyDrawingBrushRef.current();

            // seed initial history after load
            requestAnimationFrame(() => {
                if (disposed) return;
                const initialJSON = canvas.toJSON() as Record<string, unknown>;
                historyRef.current = [initialJSON];
                historyIndexRef.current = 0;
            });
        };
        void loadCanvas();

        // Push state on every completed stroke
        const handlePathCreated = () => {
            pushHistory();
        };
        canvas.on("path:created", handlePathCreated);

        // Fix: on mobile/stylus, browser fires pointercancel instead of pointerup
        // which leaves Fabric's brush stuck "down", connecting the next stroke.
        const forceEndStroke = () => {
            const c = fabricRef.current;
            if (!c || !c.isDrawingMode) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cAny = c as any;
            if (cAny._isCurrentlyDrawing) {
                try { cAny.freeDrawingBrush?._finalizeAndAddPath?.(); } catch {}
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
            upperCanvas?.removeEventListener("pointercancel", forceEndStroke);
            upperCanvas?.removeEventListener("touchcancel", forceEndStroke);
            canvas.dispose();
            fabricRef.current = null;
        };
    }, [note]);

    useEffect(() => {
        applyDrawingBrush();
    }, [applyDrawingBrush]);
async function uploadPreviewImage(dataUrl: string, oldUrl?: string | null) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  const fileName = `borrower-notes/${crypto.randomUUID()}.webp`;

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

  const { data } = supabase.storage.from("borrower-notes").getPublicUrl(fileName);
  return data.publicUrl;
}
    const saveNotes = useCallback(async () => {
        if (!fabricRef.current) return;

        try {
            setSaving(true);

            const canvas = fabricRef.current;

            const rawJSON = canvas.toJSON() as Record<string, unknown>;
            if (Array.isArray(rawJSON.objects)) {
                rawJSON.objects = (rawJSON.objects as Record<string, unknown>[]).map((obj) => {
                    const { left, top, width, height, scaleX, scaleY, angle, type, path, stroke, strokeWidth, fill, globalCompositeOperation, strokeLineCap, strokeLineJoin, opacity } = obj as Record<string, unknown>;
                    const slim: Record<string, unknown> = { type };
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
                    if (globalCompositeOperation !== undefined) slim.globalCompositeOperation = globalCompositeOperation;
                    if (strokeLineCap !== undefined) slim.strokeLineCap = strokeLineCap;
                    if (strokeLineJoin !== undefined) slim.strokeLineJoin = strokeLineJoin;
                    if (opacity !== undefined && opacity !== 1) slim.opacity = opacity;
                    return slim;
                });
            }
            const canvas_json = await compressJSON(rawJSON);

      const preview_image_url = await uploadPreviewImage(
                        canvas.toDataURL({
                         format: "webp",

  quality: 0.85, // 👈 big improvement

  multiplier: 2, // 👈 renders at 2x resolution (key upgrade)

  enableRetinaScaling: true,
                        }),
                        note?.preview_img_url
                        );
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
        canvas.backgroundColor = NOTES_CANVAS_PAPER;
        canvas.renderAll();
        pushHistory();
        applyDrawingBrushRef.current();
    };

    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    return (
        <div className="flex flex-col gap-2 h-full">
            {/* Persistent top bar — save / clear / hide always showing */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-900 bg-white p-2 shadow-[3px_3px_0px_0px_#0f172a]">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            void saveNotes();
                        }}
                        disabled={saving}
                        className="rounded-md border-2 border-slate-900 bg-emerald-200 px-3 py-1 text-xs font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5 disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>

                    <button
                        type="button"
                        onClick={clearCanvas}
                        className="rounded-md border-2 border-slate-900 bg-rose-100 px-3 py-1 text-xs font-bold uppercase text-rose-800 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5"
                    >
                        Clear
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => setShowTools((p) => !p)}
                    className="rounded-md border-2 border-slate-900 bg-slate-900 px-2.5 py-1 text-xs font-bold uppercase text-white shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5"
                >
                    {showTools ? "Hide tools" : "Show tools"}
                </button>
            </div>

            {/* Canvas with floating tools */}
            <div className="flex flex-col gap-2 flex-1 min-h-0">
                {/* Drawing toolbar */}
                {showTools && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white/95 p-1.5 shadow-[3px_3px_0px_0px_#0f172a]">
                        <button
                            type="button"
                            onClick={() => setActiveTool("pen")}
                            className={`rounded-md border-2 border-slate-900 px-2 py-1 text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5 ${
                                activeTool === "pen"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-slate-900"
                            }`}
                        >
                            Pen
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTool("eraser")}
                            className={`rounded-md border-2 border-slate-900 px-2 py-1 text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5 ${
                                activeTool === "eraser"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-slate-900"
                            }`}
                        >
                            Eraser
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTool("select")}
                            className={`rounded-md border-2 border-slate-900 px-2 py-1 text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5 ${
                                activeTool === "select"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-slate-900"
                            }`}
                        >
                            Select
                        </button>

                        <label className="flex items-center gap-1">
                            <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                                disabled={activeTool !== "pen"}
                                title="Brush color (pen)"
                                className="h-6 w-8 cursor-pointer rounded border-2 border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={undo}
                            disabled={!canUndo}
                            title="Undo (Ctrl+Z)"
                            className="rounded-md border-2 border-slate-900 bg-white p-1 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5 disabled:opacity-40 disabled:shadow-none"
                        >
                            <Undo2 className="size-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={redo}
                            disabled={!canRedo}
                            title="Redo (Ctrl+Shift+Z)"
                            className="rounded-md border-2 border-slate-900 bg-white p-1 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5 disabled:opacity-40 disabled:shadow-none"
                        >
                            <Undo2 className="size-3.5 -scale-x-100" />
                        </button>
                    </div>
                )}

                <div
                    ref={containerRef}
                    className="flex-1 min-h-0 overflow-hidden rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                    style={{ backgroundColor: NOTES_CANVAS_PAPER, touchAction: "none" }}
                >
                    <div className="w-full h-full">
                        <canvas
                            ref={canvasElRef}
                            tabIndex={-1}
                            className="block h-full w-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
