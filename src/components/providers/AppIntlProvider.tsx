"use client"

import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import type { AppLocale } from "@/i18n/config"

type Props = {
  children: ReactNode
  locale: AppLocale
  messages: Record<string, unknown>
}

export function AppIntlProvider({ children, locale, messages }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
