"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";

type Note = Record<string, unknown> & {
  id: string;
  preview_img_url?: string | null;
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
};

function SortableNote({
  note,
  resolvedTheme,
  onClick,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  note: Note;
  resolvedTheme: string;
  onClick: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 10 : ("auto" as const),
    }),
    [transform, transition, isDragging],
  );

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="relative aspect-9/16 w-full cursor-pointer overflow-hidden
          rounded-sm shadow-md"
      >
        {note.preview_img_url ? (
          <img
            src={
              resolvedTheme === "dark"
                ? (note.preview_img_url as string).replace(
                    /\.webp$/,
                    "-dark.webp",
                  )
                : (note.preview_img_url as string)
            }
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                note.preview_img_url as string;
            }}
            className="pointer-events-none h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center
              bg-slate-100"
          >
            <span className="text-xs text-slate-400">No preview</span>
          </div>
        )}
      </motion.div>

      {/* Desktop drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 hidden touch-manipulation rounded
          bg-black/40 p-1 text-white shadow-sm transition hover:bg-black/70
          active:cursor-grabbing active:bg-black/70 md:flex md:opacity-0
          md:group-hover:opacity-100"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Mobile arrow buttons */}
      <div
        className="absolute right-2 top-2 flex flex-col gap-1 md:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          className="rounded bg-black/40 p-1 text-white shadow-sm transition
            active:bg-black/70 disabled:opacity-30"
          aria-label="Move note up"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          className="rounded bg-black/40 p-1 text-white shadow-sm transition
            active:bg-black/70 disabled:opacity-30"
          aria-label="Move note down"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function SortableNotesGrid({
  notes,
  borrowerId,
  resolvedTheme,
  onNoteClick,
}: {
  notes: Note[];
  borrowerId: string;
  resolvedTheme: string;
  onNoteClick: (note: Note) => void;
}) {
  const [ordered, setOrdered] = useState<Note[]>(notes);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateBorrowerDetails();

  useEffect(() => {
    setOrdered(notes);
  }, [notes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const saveOrder = async (next: Note[]) => {
    setSaving(true);

    try {
      const updates = next.map((note, index) => ({
        id: note.id,
        sort_order: index,
      }));

      await Promise.all(
        updates.map((u) =>
          supabase
            .from("borrower_notes")
            .update({ sort_order: u.sort_order })
            .eq("id", u.id),
        ),
      );

      invalidate(borrowerId);
      toast.success("Note order saved");
    } catch {
      toast.error("Failed to save note order");
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((n) => n.id === active.id);
    const newIndex = ordered.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    void saveOrder(next);
  };

  const handleMoveUp = (id: string) => {
    const index = ordered.findIndex((n) => n.id === id);
    if (index <= 0) return;

    const next = arrayMove(ordered, index, index - 1);
    setOrdered(next);
    void saveOrder(next);
  };

  const handleMoveDown = (id: string) => {
    const index = ordered.findIndex((n) => n.id === id);
    if (index === -1 || index >= ordered.length - 1) return;

    const next = arrayMove(ordered, index, index + 1);
    setOrdered(next);
    void saveOrder(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ordered.map((n) => n.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className={`grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 ${
            saving ? "pointer-events-none opacity-80" : ""
          }`}
        >
          {ordered.map((note, index) => (
            <SortableNote
              key={note.id}
              note={note}
              resolvedTheme={resolvedTheme}
              onClick={() => onNoteClick(note)}
              canMoveUp={index > 0}
              canMoveDown={index < ordered.length - 1}
              onMoveUp={() => handleMoveUp(note.id)}
              onMoveDown={() => handleMoveDown(note.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
