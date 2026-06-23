import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const allowedRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session || !allowedRoles.includes(user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { title, description, homework, notes, classroomId, subjectId } = body

  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
  })
  if (!activeYear) return NextResponse.json({ error: "No active academic year" }, { status: 400 })

  let teacherId: string
  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 })
    teacherId = teacher.id
  } else {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { classroomId, subjectId, schoolId: user.schoolId, academicYearId: activeYear.id },
    })
    teacherId = assignment?.teacherId || ""
    if (!teacherId) return NextResponse.json({ error: "No teacher assigned" }, { status: 404 })
  }

  const lesson = await prisma.lesson.create({
    data: { title, description, homework, notes, classroomId, subjectId, teacherId, schoolId: user.schoolId, academicYearId: activeYear.id, status: "DRAFT" },
  })

  return NextResponse.json(lesson)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const classroomId = url.searchParams.get("classroomId")
  const subjectId = url.searchParams.get("subjectId")

  const lessons = await prisma.lesson.findMany({
    where: { schoolId: user.schoolId, ...(classroomId && { classroomId }), ...(subjectId && { subjectId }) },
    include: { classroom: true, subject: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(lessons)
}