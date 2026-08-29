import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id || user?.role !== "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parent = await prisma.parent.findUnique({
    where: { userId: user.id },
  })
  if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 })

  const links = await prisma.studentParent.findMany({
    where: { parentId: parent.id, receiveNotifications: true },
    include: {
      student: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              classroom: {
                include: { level: { include: { stage: true } }, stream: true },
              },
            },
          },
        },
      },
    },
  })

  const children = links.map((link) => {
    const enrollment = link.student.enrollments[0]
    return {
      id: link.student.id,
      firstName: link.student.firstName,
      lastName: link.student.lastName,
      studentNumber: link.student.studentNumber,
      gender: link.student.gender,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            classroom: {
              id: enrollment.classroom.id,
              name: enrollment.classroom.name,
              level: enrollment.classroom.level.name,
              stage: enrollment.classroom.level.stage.name,
              stream: enrollment.classroom.stream?.name || null,
            },
          }
        : null,
    }
  })

  return NextResponse.json({ children })
}
