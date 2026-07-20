"use client"

import { Languages } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { cn } from "@/lib/utils"

const localeOptions = [
  { value: "ar", labelKey: "arabic" },
  { value: "fr", labelKey: "french" },
] as const

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("locale")
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function updateLocale(nextLocale: string) {
    if (nextLocale === locale) return

    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      })

      router.refresh()
    })
  }

  return (
    <div
      className={cn("inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm", className)}
      role="group"
      aria-label={t("switcherLabel")}
    >
      <Languages className="mx-1 h-4 w-4 text-gray-400" aria-hidden="true" />
      {localeOptions.map((option) => {
        const active = option.value === locale

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => updateLocale(option.value)}
            disabled={isPending}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100",
              isPending && "cursor-wait opacity-70"
            )}
          >
            {t(option.labelKey)}
          </button>
        )
      })}
    </div>
  )
}
