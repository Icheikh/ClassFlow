import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isWhatsAppConfigured } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"

/** Real channel readiness (no secrets) for the director's status indicator. Wasender only. */
export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const channels = [
    { key: "WHATSAPP", ready: isWhatsAppConfigured() },
  ]
  return NextResponse.json({ channels, anyReady: channels.some((c) => c.ready) })
}
