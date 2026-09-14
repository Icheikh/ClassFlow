/**
 * School-created accounts — the ONLY way accounts are created.
 * No self-registration exists. Directors create TEACHER / PARENT / STAFF
 * accounts by phone number; users only activate and log in.
 *
 * One User row per (schoolId, phoneNormalized). The same person can be
 * both a teacher and a parent: both profile rows point to the same userId,
 * and the session carries `extraRoles` so both portals stay accessible.
 */
import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { normalizePhone, maskPhone } from "./phone"
import { sendAccountInvite } from "./otp"

export type CreatableRole = "TEACHER" | "PARENT" | "STAFF"

export async function findSchoolUserByPhone(schoolId: string, phoneNormalized: string) {
  return prisma.user.findUnique({
    where: { schoolId_phoneNormalized: { schoolId, phoneNormalized } },
    include: { teacher: true, parent: true, school: true },
  })
}

/** Extra portal roles derived from linked profiles (same-phone teacher+parent). */
export async function getExtraRoles(userId: string, primaryRole: string): Promise<string[]> {
  const [teacher, parent] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId }, select: { id: true } }),
    prisma.parent.findUnique({ where: { userId }, select: { id: true } }),
  ])
  const extras: string[] = []
  if (teacher && primaryRole !== "TEACHER") extras.push("TEACHER")
  if (parent && primaryRole !== "PARENT") extras.push("PARENT")
  return extras
}

/** Portal access check honoring linked profiles (same-phone teacher+parent). */
export function canAccessPortal(
  user: { role?: string | null; extraRoles?: string[] | null } | null | undefined,
  portal: "TEACHER" | "PARENT"
): boolean {
  if (!user) return false
  if (user.role === portal) return true
  return !!user.extraRoles?.includes(portal)
}
/**
 * Find or create the school user for a phone number, then ensure the
 * requested profile row exists. Never creates duplicate users for one phone.
 */
export async function ensureSchoolUser(input: {
  schoolId: string
  phone: string
  name: string
  role: CreatableRole
  schoolName?: string
  locale?: string
  sendInvite?: boolean
  studentName?: string
}): Promise<{ user: { id: string; status: string }; createdUser: boolean; createdProfile: boolean }> {
  const phoneNormalized = normalizePhone(input.phone)
  if (!phoneNormalized) throw new Error("INVALID_PHONE")

  const name = input.name.trim()
  if (!name) throw new Error("NAME_REQUIRED")

  let user = await findSchoolUserByPhone(input.schoolId, phoneNormalized)
  let createdUser = false

  if (!user) {
    const placeholderHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10)
    user = await prisma.user.create({
      data: {
        email: null,
        passwordHash: placeholderHash,
        name,
        phone: input.phone.trim(),
        phoneNormalized,
        status: "INVITED",
        role: input.role,
        schoolId: input.schoolId,
        isActive: true,
        mustChangePassword: true,
      },
      include: { teacher: true, parent: true, school: true },
    })
    createdUser = true
  } else if (!user.name.trim() && name) {
    await prisma.user.update({ where: { id: user.id }, data: { name } })
  }

  let createdProfile = false
  if (input.role === "TEACHER" && !user.teacher) {
    await prisma.teacher.create({
      data: { schoolId: input.schoolId, userId: user.id, phone: input.phone.trim() },
    })
    createdProfile = true
  }
  if (input.role === "PARENT" && !user.parent) {
    await prisma.parent.create({
      data: { schoolId: input.schoolId, userId: user.id, phone: input.phone.trim() },
    })
    createdProfile = true
  }

  const status = (user as { status?: string }).status || "ACTIVE"

  if (input.sendInvite !== false && (createdUser || status === "INVITED")) {
    const schoolName = input.schoolName || user.school?.name || ""
    // Fire-and-forget BUT logged: registration must never fail on SMS,
    // yet silent failures are undebuggable — always log the outcome.
    sendAccountInvite({
      toPhone: input.phone.trim(),
      name: user.name || name,
      schoolName,
      role: input.role,
      locale: input.locale,
      studentName: input.studentName,
    }).then((r) => {
      if (r.sent) {
        console.log(`[accounts] invite sent to ${maskPhone(input.phone.trim())} via ${r.channel}`)
      } else {
        console.error(`[accounts] invite NOT sent to ${maskPhone(input.phone.trim())} via ${r.channel}:`, r.error)
      }
    }).catch((e) => console.error("[accounts] invite failed:", e))
  }

  return { user: { id: user.id, status }, createdUser, createdProfile }
}
