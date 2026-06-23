import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  if (!classroomId) return NextResponse.json({ error: "classroomId is required" }, { status: 400 })

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classroomId,
      schoolId: user.schoolId,
      academicYearId: activeYear?.id,
      status: "ACTIVE",
    },
    include: { student: true },
    orderBy: { student: { firstName: "asc" } },
  })

  const students = enrollments.map((e) => e.student)
  return NextResponse.json(students)
}