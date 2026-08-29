import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { startWhatsApp } from "@/lib/whatsapp/session"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (user?.role !== "SCHOOL_ADMIN" && user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await startWhatsApp()
    return NextResponse.json({ ok: true, message: "تم بدء اتصال WhatsApp" })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "فشل بدء الاتصال" }, { status: 500 })
  }
}
