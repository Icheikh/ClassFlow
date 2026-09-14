import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isWhatsAppConfigured } from "@/lib/whatsapp"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const provider = process.env.WHATSAPP_PROVIDER || "disabled"
  const configured = isWhatsAppConfigured()

  if (!configured) {
    return NextResponse.json({
      status: "DISCONNECTED" as const,
      qr: null,
      configured: false,
      disabled: provider === "disabled",
      provider,
      message: "WhatsApp غير مُعد — تحقق من WHATSAPP_PROVIDER والمفاتيح في .env",
    })
  }

  // Wasender/Meta are cloud gateways (no local QR). Real session health
  // is checked on send; a dedicated webhook/cron can promote this to live status later.
  return NextResponse.json({
    status: "CONNECTED" as const,
    qr: null,
    configured: true,
    disabled: false,
    provider,
    message: provider === "wasender"
      ? "Wasender مُعد — تأكد من أن الجلسة connected في Dashboard"
      : "WhatsApp مُعد وجاهز للإرسال",
  })
}
