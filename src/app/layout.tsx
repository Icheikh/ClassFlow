import type { Metadata } from "next"
import { Toaster } from "react-hot-toast"
import { OfflineBanner } from "@/components/ui"
import "./globals.css"

export const metadata: Metadata = {
  title: "ClassFlow - إدارة المدارس",
  description: "منصة رقمية لإدارة المدارس - ClassFlow",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <OfflineBanner />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}