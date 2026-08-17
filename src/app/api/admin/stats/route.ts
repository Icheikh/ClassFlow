import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "../guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await getAdminSession()
  if ("error" in auth) return auth.error

  const [totalSchools, activeSchools, trialSchools, totalUsers, totalStudents, totalTeachers] =
    await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { isActive: true } }),
      prisma.school.count({ where: { subscriptionStatus: "TRIAL" } }),
      prisma.user.count(),
      prisma.student.count(),
      prisma.teacher.count(),
    ])

  return NextResponse.json({
    totalSchools,
    activeSchools,
    trialSchools,
    totalUsers,
    totalStudents,
    totalTeachers,
  })
}