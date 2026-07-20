export const locales = ["ar", "fr"] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = "ar"
export const localeCookieName = "classflow-locale"

export function isValidLocale(value: string | null | undefined): value is AppLocale {
  return !!value && locales.includes(value as AppLocale)
}

export function getLocaleDirection(locale: string) {
  return locale === "ar" ? "rtl" : "ltr"
}
