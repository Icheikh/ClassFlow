import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id || user?.role !== "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parent = await prisma.parent.findUnique({ where: { userId: user.id } })
  if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get("studentId")

  const links = await prisma.studentParent.findMany({
    where: { parentId: parent.id },
    select: { studentId: true },
  })
  const childIds = links.map((l) => l.studentId)
  if (childIds.length === 0) return NextResponse.json({ children: [], stats: [], recentAbsences: [] })

  const targetIds = studentId && childIds.includes(studentId) ? [studentId] : childIds

  const where: any = { studentId: { in: targetIds } }

  const absences = await prisma.attendance.findMany({
    where: { ...where, status: "ABSENT" },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      classroom: { select: { name: true } },
      subject: { select: { nameAr: true } },
    },
  })

  const stats = await Promise.all(
    targetIds.map(async (sid) => {
      const total = await prisma.attendance.count({ where: { studentId: sid } })
      const absent = await prisma.attendance.count({ where: { studentId: sid, status: "ABSENT" } })
      const late = await prisma.attendance.count({ where: { studentId: sid, status: "LATE" } })
      const present = total - absent - late
      return { studentId: sid, total, present, absent, late, rate: total > 0 ? Math.round((present / total) * 100) : 100 }
    })
  )

  return NextResponse.json({
    children: targetIds,
    stats,
    recentAbsences: absences.map((a) => ({
      id: a.id,
      date: a.date,
      status: a.status,
      student: a.student,
      classroom: a.classroom.name,
      subject: a.subject?.nameAr || null,
    })),
  })
}
