import type { Metadata } from "next"
import { Toaster } from "react-hot-toast"
import { OfflineBanner } from "@/components/ui"
import { AppIntlProvider } from "@/components/providers/AppIntlProvider"
import { getLocaleDirection } from "@/i18n/config"
import { getRequestLocale } from "@/i18n/getRequestLocale"
import { getMessages } from "@/i18n/messages"
import "./globals.css"

export const metadata: Metadata = {
  title: "ClassFlow",
  description: "ClassFlow",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getRequestLocale()
  const messages = getMessages(locale)
  const direction = getLocaleDirection(locale)

  return (
    <html lang={locale} dir={direction}>
      <body>
        <AppIntlProvider locale={locale} messages={messages}>
          <OfflineBanner />
          {children}
          <Toaster position="top-center" />
        </AppIntlProvider>
      </body>
    </html>
  )
}
