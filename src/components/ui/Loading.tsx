import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg"
  className?: string
  message?: string
}

const sizes = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
}

export function LoadingSpinner({ size = "md", className, message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <Loader2 className={cn("animate-spin text-blue-600", sizes[size], className)} aria-hidden="true" />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  )
}

export function LoadingPage() {
  const t = useTranslations("common")
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" message={t("loading")} />
    </div>
  )
}
