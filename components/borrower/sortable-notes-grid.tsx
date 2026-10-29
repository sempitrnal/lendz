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
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  StickyNote,
} from "lucide-react";
import { m } from "motion/react";
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
      <m.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="relative aspect-9/16 w-full cursor-pointer overflow-hidden
          rounded-xl bg-muted ring-1 ring-black/10 dark:ring-white/10"
      >
        {note.preview_img_url ? (
          <img
            alt="Note preview"
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
          <div className="flex h-full w-full items-center justify-center
            bg-muted">
            <span className="text-xs text-muted-foreground">No preview</span>
          </div>
        )}
      </m.div>

      {/* Desktop drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 hidden touch-manipulation rounded-full
          bg-black/45 p-1.5 text-white shadow-sm backdrop-blur-sm transition
          hover:bg-black/70 active:cursor-grabbing active:bg-black/70 md:flex
          md:opacity-0 md:group-hover:opacity-100"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

      {/* Mobile: earlier / later, a small pill at the tile's foot (a lone
          note has nowhere to go) */}
      <div
        className={`absolute right-2 bottom-2 gap-0.5 rounded-full bg-black/45
          p-0.5 backdrop-blur-sm md:hidden ${
            canMoveUp || canMoveDown ? "flex" : "hidden"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          className="flex size-7 items-center justify-center rounded-full
            text-white transition active:bg-white/25 disabled:opacity-30"
          aria-label="Move note earlier"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          className="flex size-7 items-center justify-center rounded-full
            text-white transition active:bg-white/25 disabled:opacity-30"
          aria-label="Move note later"
        >
          <ChevronRight className="size-4" />
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
  onAddNote,
}: {
  notes: Note[];
  borrowerId: string;
  resolvedTheme: string;
  onNoteClick: (note: Note) => void;
  /** Starts a new note; the header's add button calls it. */
  onAddNote?: () => void;
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

  if (ordered.length === 0) return null;

  return (
    <section
      aria-label="Notes"
      className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1
        ring-black/5 dark:ring-white/10"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center
            rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/20
            dark:text-sky-300"
        >
          <StickyNote className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-black text-card-foreground/80 lowercase">
          notes
        </h2>
        <span
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold
            text-muted-foreground tabular-nums"
        >
          {ordered.length}
        </span>
        {onAddNote && (
          <button
            type="button"
            onClick={onAddNote}
            className="ml-auto flex items-center gap-1 rounded-full
              bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700
              active:bg-emerald-200 dark:bg-emerald-500/20
              dark:text-emerald-300"
          >
            <Plus className="size-3.5" aria-hidden="true" /> add
          </button>
        )}
      </div>
      <div className="px-3 pb-3">
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
              className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4
                ${saving ? "pointer-events-none opacity-80" : ""}`}
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
      </div>
    </section>
  );
}
