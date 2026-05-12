"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, PencilBrush, type Path, type Canvas as FabricCanvas } from "fabric";
import { supabase } from "@/lib/supabase/client";

/** Keep in sync with Canvas `backgroundColor` and wrapper fill. */
const NOTES_CANVAS_PAPER = "#fffdf5";

function paperStrokeColor(canvas: FabricCanvas): string {
    const bg = canvas.backgroundColor;
    return typeof bg === "string" && bg.length > 0 ? bg : NOTES_CANVAS_PAPER;
}

/** Minimal fields used by the canvas; note rows may include more from Supabase. */
export type BorrowerNotePayload = Record<string, unknown> & {
    id?: string;
    canvas_json?: unknown;
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

    const [showTools, setShowTools] = useState(true);
    const [saving, setSaving] = useState(false);
    const [brushColor, setBrushColor] = useState("#111111");
    const [activeTool, setActiveTool] = useState<DrawTool>("pen");

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
            if (!canvasElRef.current || !fabricRef.current) return;

            const c = fabricRef.current;

            const parent = canvasElRef.current.parentElement?.parentElement;

            if (!parent) return;

            const width = parent.getBoundingClientRect().width;

            c.setDimensions({
                width,
                height: 500,
            });

            c.calcOffset();
            c.renderAll();
        };
        requestAnimationFrame(() => {
            resizeCanvas();
        });

        window.addEventListener("resize", resizeCanvas);

        // load saved JSON
        const loadCanvas = async () => {
            if (note?.canvas_json) {
                try {
                    canvas.clear();

                    await canvas.loadFromJSON(note.canvas_json);

                    canvas.backgroundColor = NOTES_CANVAS_PAPER;

                    canvas.renderAll();
                } catch (err) {
                    console.error("Failed to load canvas JSON", err);
                }
            }

            applyDrawingBrushRef.current();
        };
        void loadCanvas();

        return () => {
            window.removeEventListener("resize", resizeCanvas);

            canvas.dispose();

            fabricRef.current = null;
        };
    }, [note]);

    useEffect(() => {
        applyDrawingBrush();
    }, [applyDrawingBrush]);

    const saveNotes = useCallback(async () => {
        if (!fabricRef.current) return;

        try {
            setSaving(true);

            const canvas = fabricRef.current;

            const canvas_json = canvas.toJSON();

            const preview_image = canvas.toDataURL({
                format: "png",
                quality: 1,
                multiplier: 2,
                enableRetinaScaling: true,
            });

            // UPDATE EXISTING NOTE
            if (note?.id) {
                const { data, error } = await supabase
                    .from("borrower_notes")
                    .update({
                        canvas_json,
                        preview_image,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", note.id)
                    .select()
                    .single();

                if (error) {
                    console.error(error);
                    return;
                }

                onSaved?.(data);

                return;
            }

            // CREATE NEW NOTE
            const { data, error } = await supabase
                .from("borrower_notes")
                .insert({
                    borrower_id: borrowerId,
                    canvas_json,
                    preview_image,
                    x: 40,
                    y: 40,
                })
                .select()
                .single();

            if (error) {
                console.error(error);
                return;
            }

            onSaved?.(data);
        } catch (err) {
            console.error(err);
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

        applyDrawingBrushRef.current();
    };

    return (
        <div
            className="relative overflow-hidden rounded-xl border shadow-sm"
            style={{ backgroundColor: NOTES_CANVAS_PAPER }}
        >
            {/* Toggle tools */}
            <button
                type="button"
                onClick={() => setShowTools((p) => !p)}
                className="absolute right-3 top-3 z-20 rounded-md bg-black px-3 py-1 text-xs font-medium text-white"
            >
                {showTools ? "hide tools" : "show tools"}
            </button>

            {/* Toolbar */}
            {showTools && (
                <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2 shadow-md">
                    <button
                        type="button"
                        onClick={() => setActiveTool("pen")}
                        className={`rounded-md px-3 py-1 text-xs hover:bg-slate-100 ${
                            activeTool === "pen"
                                ? "bg-slate-900 font-semibold text-white"
                                : ""
                        }`}
                    >
                        Pen
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTool("eraser")}
                        className={`rounded-md px-3 py-1 text-xs hover:bg-slate-100 ${
                            activeTool === "eraser"
                                ? "bg-slate-900 font-semibold text-white"
                                : ""
                        }`}
                    >
                        Eraser
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTool("select")}
                        className={`rounded-md px-3 py-1 text-xs hover:bg-slate-100 ${
                            activeTool === "select"
                                ? "bg-slate-900 font-semibold text-white"
                                : ""
                        }`}
                    >
                        Select
                    </button>

                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="font-medium uppercase tracking-wide">
                            Color
                        </span>
                        <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            disabled={activeTool !== "pen"}
                            title="Brush color (pen)"
                            className="h-8 w-10 cursor-pointer rounded border-2 border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                    </label>

                    <button
                        type="button"
                        onClick={() => {
                            void saveNotes();
                        }}
                        disabled={saving}
                        className="rounded-md bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>

                    <button
                        type="button"
                        onClick={clearCanvas}
                        className="rounded-md px-3 py-1 text-xs hover:bg-red-100"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Canvas */}
            <div className="w-full">
                <canvas
                    ref={canvasElRef}
                    tabIndex={-1}
                    className="block h-[500px] w-full"
                />
            </div>
        </div>
    );
}
