import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { logoutWhatsApp } from "@/lib/whatsapp/session"

export async function POST() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (user?.role !== "SCHOOL_ADMIN" && user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await logoutWhatsApp()
    return NextResponse.json({ ok: true, message: "تم قطع الاتصال وحذف الجلسة" })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "فشل قطع الاتصال" }, { status: 500 })
  }
}
