"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "bg-white rounded-2xl shadow-xl p-6 w-[90vw] max-w-md max-h-[85vh] overflow-y-auto",
            "focus:outline-none",
            className
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}