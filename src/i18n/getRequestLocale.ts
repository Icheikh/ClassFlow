import { cookies } from "next/headers"
import { defaultLocale, isValidLocale, localeCookieName, type AppLocale } from "./config"

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies()
  const locale = cookieStore.get(localeCookieName)?.value
  return isValidLocale(locale) ? locale : defaultLocale
}
