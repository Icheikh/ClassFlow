import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId || user.role !== "SCHOOL_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, phone, email, address } = body

  const school = await prisma.school.update({
    where: { id: user.schoolId },
    data: { name, phone, email, address },
  })
  return NextResponse.json(school)
}
