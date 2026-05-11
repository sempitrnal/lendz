"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, PencilBrush } from "fabric";
import { supabase } from "@/lib/supabase/client";
type NotesCanvasProps = {
    borrowerId: string;
    note?: any;
    onSaved?: (note: any) => void;
};
export default function NotesCanvas({
    borrowerId,
    note,
    onSaved,
}: NotesCanvasProps) {
    const canvasElRef = useRef<HTMLCanvasElement | null>(null);
    const fabricRef = useRef<Canvas | null>(null);

    const [showTools, setShowTools] = useState(true);
    const [saving, setSaving] = useState(false);

    // initialize canvas
    useEffect(() => {
        if (!canvasElRef.current) return;

        const canvas = new Canvas(canvasElRef.current, {
            backgroundColor: "#fffdf5",
            isDrawingMode: true,
            preserveObjectStacking: true,
        });

        fabricRef.current = canvas;

        // brush
        const brush = new PencilBrush(canvas);
        brush.width = 2;
        brush.color = "#111111";

        canvas.freeDrawingBrush = brush;

        const resizeCanvas = () => {
            if (!canvasElRef.current || !fabricRef.current) return;

            const canvas = fabricRef.current;

            // canvas -> fabric wrapper -> YOUR container
            const parent =
                canvasElRef.current.parentElement?.parentElement;

            if (!parent) return;

            const width = parent.getBoundingClientRect().width;

            canvas.setDimensions({
                width,
                height: 500,
            });

            canvas.calcOffset();
            canvas.renderAll();
        };
        requestAnimationFrame(() => {
            resizeCanvas();
        });

        window.addEventListener("resize", resizeCanvas);

        // load saved JSON
        const loadCanvas = async () => {
            if (!note?.canvas_json) return;

            try {
                canvas.clear();

                await canvas.loadFromJSON(note.canvas_json);

                canvas.backgroundColor = "#fffdf5";

                canvas.renderAll();
            } catch (err) {
                console.error(
                    "Failed to load canvas JSON",
                    err
                );
            }
        };
        loadCanvas();

        return () => {
            window.removeEventListener("resize", resizeCanvas);

            canvas.dispose();

            fabricRef.current = null;
        };
    }, [note]);

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

        canvas.backgroundColor = "#fffdf5";

        canvas.renderAll();

        // restore brush after clear
        const brush = new PencilBrush(canvas);
        brush.width = 2;
        brush.color = "#111111";

        canvas.freeDrawingBrush = brush;
    };

    const enableDrawing = () => {
        if (!fabricRef.current) return;

        fabricRef.current.isDrawingMode = true;
    };

    const enableSelection = () => {
        if (!fabricRef.current) return;

        fabricRef.current.isDrawingMode = false;
    };

    return (
        <div className="relative rounded-xl border bg-white shadow-sm overflow-hidden">
            {/* Toggle tools */}
            <button
                onClick={() => setShowTools((p) => !p)}
                className="absolute right-3 top-3 z-20 rounded-md bg-black px-3 py-1 text-xs font-medium text-white"
            >
                {showTools ? "hide tools" : "show tools"}
            </button>

            {/* Toolbar */}
            {showTools && (
                <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-xl border bg-white p-2 shadow-md">
                    <button
                        onClick={enableDrawing}
                        className="rounded-md px-3 py-1 text-xs hover:bg-slate-100"
                    >
                        Pen
                    </button>

                    <button
                        onClick={enableSelection}
                        className="rounded-md px-3 py-1 text-xs hover:bg-slate-100"
                    >
                        Select
                    </button>

                    <button
                        onClick={saveNotes}
                        disabled={saving}
                        className="rounded-md bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>

                    <button
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
                    className="block h-[500px] w-full"
                />
            </div>
        </div>
    );
}