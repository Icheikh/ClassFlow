import { NextResponse } from "next/server"
import { defaultLocale, isValidLocale, localeCookieName } from "@/i18n/config"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const locale = isValidLocale(body?.locale) ? body.locale : defaultLocale
  const response = NextResponse.json({ ok: true, locale })

  response.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  return response
}
