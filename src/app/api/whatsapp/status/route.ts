import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    status: "DISCONNECTED" as const,
    qr: null,
    configured: false,
    disabled: true,
    message: "WhatsApp معطل — يتم استخدام SMS والإشعارات الداخلية",
  })
}
