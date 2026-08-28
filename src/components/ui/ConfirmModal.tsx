"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Input } from "./Input"

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
  confirmKeyword?: string
  confirmKeywordLabel?: string
  confirmKeywordPlaceholder?: string
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = "danger",
  loading = false,
  confirmKeyword,
  confirmKeywordLabel,
  confirmKeywordPlaceholder,
}: ConfirmModalProps) {
  const locale = useLocale()
  const resolvedConfirmText = confirmText ?? (locale === "fr" ? "Confirmer" : "تأكيد")
  const resolvedCancelText = cancelText ?? (locale === "fr" ? "Annuler" : "إلغاء")
  const [typed, setTyped] = useState("")

  useEffect(() => {
    if (!open) setTyped("")
  }, [open])

  const requiresKeyword = typeof confirmKeyword === "string"
  const canConfirm = !requiresKeyword || typed.trim() === confirmKeyword

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-gray-600 mb-4">{message}</p>
      {requiresKeyword && (
        <Input
          label={confirmKeywordLabel}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={confirmKeywordPlaceholder}
          className="mb-4"
        />
      )}
      <div className="flex gap-3">
        <Button
          variant={variant}
          onClick={onConfirm}
          loading={loading}
          disabled={loading || !canConfirm}
          className="flex-1"
        >
          {resolvedConfirmText}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
          {resolvedCancelText}
        </Button>
      </div>
    </Modal>
  )
}
