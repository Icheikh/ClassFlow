import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (user?.role !== "SCHOOL_ADMIN" && user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ ok: true, message: "WhatsApp معطل بالفعل" })
}
