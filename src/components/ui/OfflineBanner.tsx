"use client"

import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"
import { useTranslations } from "next-intl"

export function OfflineBanner() {
  const t = useTranslations("offline")
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    function handleOnline() { setOffline(false) }
    function handleOffline() { setOffline(true) }
    setOffline(!navigator.onLine)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-2"
      role="alert"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      {t("message")}
    </div>
  )
}
