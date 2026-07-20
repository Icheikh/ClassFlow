"use client"

import { useTranslations } from "next-intl"

export default function TeacherError({ error, reset }: { error: Error; reset: () => void }) {
  const tErrors = useTranslations("errors")
  const t = useTranslations("teacherError")
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" role="alert">
      <h2 className="text-xl font-bold text-red-600">{t("title")}</h2>
      <p className="text-gray-500 text-sm">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        {tErrors("retry")}
      </button>
    </div>
  )
}
