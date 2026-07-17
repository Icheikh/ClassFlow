"use client"

import { Modal } from "./Modal"
import { Button } from "./Button"

type ConfirmModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "primary"
  loading?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3">
        <Button variant={variant} onClick={onConfirm} loading={loading} className="flex-1">
          {confirmText}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
          {cancelText}
        </Button>
      </div>
    </Modal>
  )
}
