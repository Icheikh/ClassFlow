import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isWhatsAppConfigured } from "@/lib/whatsapp"
import { isVonageConfigured } from "@/lib/vonage"
import { isMoorsylConfigured } from "@/lib/moorsyl"

export const dynamic = "force-dynamic"

/** Real channel readiness (no secrets) for the director's status indicator. */
export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const channels = [
    { key: "WHATSAPP", ready: isWhatsAppConfigured() },
    { key: "VONAGE_SMS", ready: isVonageConfigured() },
    { key: "MOORSYL_SMS", ready: isMoorsylConfigured() },
  ]
  return NextResponse.json({ channels, anyReady: channels.some((c) => c.ready) })
}
