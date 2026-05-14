"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type SelectionCtx = {
  selectedIds: Set<string>;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  toggleId: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
  hasSelection: boolean;
};

const Context = createContext<SelectionCtx | null>(null);

export function ScheduleSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditingState] = useState(false);

  const setIsEditing = useCallback((v: boolean) => {
    setIsEditingState(v);
    if (!v) setSelectedIds(new Set());
  }, []);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return (
    <Context.Provider
      value={{
        selectedIds,
        isEditing,
        setIsEditing,
        toggleId,
        selectAll,
        clearAll,
        isSelected,
        hasSelection: selectedIds.size > 0,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useScheduleSelection(): SelectionCtx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing ScheduleSelectionProvider");
  return ctx;
}
