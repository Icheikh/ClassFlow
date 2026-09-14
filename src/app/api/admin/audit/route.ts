import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "../guard"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = await getAdminSession()
  if ("error" in auth) return auth.error

  const url = new URL(req.url)
  const schoolId = url.searchParams.get("schoolId")
  const entityType = url.searchParams.get("entityType")
  const action = url.searchParams.get("action")
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "50")
  const skip = (page - 1) * limit

  const where: any = {}
  if (schoolId) where.schoolId = schoolId
  if (entityType) where.entityType = entityType
  if (action) where.action = action

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        school: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, limit })
}
