import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const year = await prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isActive: true } })
  const yearId = year?.id

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const teachers = await prisma.teacher.findMany({
    where: { schoolId: user.schoolId },
    include: { user: { select: { name: true } } },
  })

  const rows = await Promise.all(teachers.map(async (t) => {
    const lessons = await prisma.lesson.findMany({
      where: { teacherId: t.id, academicYearId: yearId, date: { gte: monthStart } },
      select: { duration: true },
    })
    const totalMinutes = lessons.reduce((s, l) => s + (l.duration || 0), 0)
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10
    const earnings = t.hourlyRate ? Math.round(totalHours * t.hourlyRate * 10) / 10 : null
    return {
      id: t.id,
      name: t.user.name,
      hourlyRate: t.hourlyRate,
      totalHours,
      lessonCount: lessons.length,
      earnings,
    }
  }))

  const totalEarnings = rows.reduce((s, r) => s + (r.earnings || 0), 0)
  const grandTotalHours = rows.reduce((s, r) => s + r.totalHours, 0)

  return NextResponse.json({ rows, totalEarnings, grandTotalHours })
}