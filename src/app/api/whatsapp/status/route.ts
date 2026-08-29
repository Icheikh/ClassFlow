import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWhatsAppStatus, getLatestQR } from "@/lib/whatsapp/session"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = getWhatsAppStatus()
  const qr = getLatestQR()

  return NextResponse.json({
    status,
    qr,
    configured: true,
  })
}
