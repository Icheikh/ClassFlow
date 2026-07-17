"use client"

import { RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "./Button"

type ErrorDisplayProps = {
  message?: string
  onRetry?: () => void
}

export function ErrorDisplay({ message = "تعذر تحميل البيانات", onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4" role="alert">
      <AlertTriangle className="h-10 w-10 text-red-400" aria-hidden="true" />
      <p className="text-red-500 text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> إعادة المحاولة
        </Button>
      )}
    </div>
  )
}
