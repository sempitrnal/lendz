"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import BorrowerForm from "@/components/forms/borrower-form"

type AddBorrowerFabProps = {
  onSuccess?: () => void
}

export default function AddBorrowerFab({ onSuccess }: AddBorrowerFabProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const closeModal = useCallback(() => setOpen(false), [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isMounted &&
        createPortal(
          <button
            type="button"
            aria-label="Add borrower"
            onClick={() => setOpen(true)}
            className="group fixed right-5 bottom-24 z-50 flex h-14 items-center gap-0 overflow-hidden rounded-full bg-primary pr-0 pl-0 text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/20 transition-all duration-300 ease-out hover:pr-5 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 md:right-8 md:bottom-12"
          >
            <span className="flex size-14 shrink-0 items-center justify-center">
              <Plus className="size-6 transition-transform duration-300 group-hover:rotate-90" />
            </span>
            <span className="max-w-0 whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 ease-out group-hover:max-w-40 group-hover:opacity-100">
              Add borrower
            </span>
          </button>,
          document.body,
        )}

      <DialogContent className="sm:max-w-md overflow-visible!">
        <DialogHeader className="gap-3 pb-2">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Plus className="size-5" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-lg font-bold">Add borrower</DialogTitle>
            <DialogDescription>Create a new account profile.</DialogDescription>
          </div>
        </DialogHeader>

        <BorrowerForm
          onSuccess={() => {
            onSuccess?.()
            closeModal()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
