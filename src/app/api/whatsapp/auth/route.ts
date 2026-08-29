import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user
  if (user?.role !== "SCHOOL_ADMIN" && user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(
    { error: "WhatsApp معطل — يتم استخدام SMS والإشعارات الداخلية حالياً" },
    { status: 503 }
  )
}
