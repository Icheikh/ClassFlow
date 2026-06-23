import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const allowedRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !allowedRoles.includes(user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })

  if (!activeYear) {
    return NextResponse.json([])
  }

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
    })
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 })

    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId: teacher.id, academicYearId: activeYear.id, isActive: true },
      include: { classroom: { include: { level: true, stream: true } }, subject: true },
    })
    return NextResponse.json(assignments)
  }

  const assignments = await prisma.teacherAssignment.findMany({
    where: { schoolId: user.schoolId, academicYearId: activeYear.id, isActive: true },
    include: {
      classroom: { include: { level: true, stream: true } },
      subject: true,
      teacher: { include: { user: true } },
    },
    orderBy: [{ classroom: { name: "asc" } }, { subject: { nameAr: "asc" } }],
  })

  return NextResponse.json(assignments)
}