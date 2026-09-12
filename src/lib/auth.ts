import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { getUserPermissions } from "./permissions"
import { normalizePhone, maskPhone } from "./phone"
import { getExtraRoles } from "./user-accounts"

export type SessionUser = {
  id: string
  /** Legacy email (nullable). Phone is the primary identity. */
  email: string | null
  phone: string | null
  name: string
  role: string
  /** Extra portals from linked profiles (e.g. teacher who is also a parent). */
  extraRoles: string[]
  schoolId: string | null
  school: { id: string; name: string; slug: string } | null
  permissions?: string[]
  mustChangePassword: boolean
}

declare module "next-auth" {
  interface Session {
    user: SessionUser
  }
  interface User extends SessionUser {}
}

declare module "next-auth/jwt" {
  interface JWT extends SessionUser {}
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawPhone = String(
          (credentials as Record<string, unknown>)?.phone ?? ""
        ).trim()
        const password = String((credentials as Record<string, unknown>)?.password ?? "")
        if (!rawPhone || !password) return null
        // Email login is disabled: phone numbers never contain "@".
        if (rawPhone.includes("@")) return null

        const phoneNormalized = normalizePhone(rawPhone)
        if (!phoneNormalized) return null

        const candidates = await prisma.user.findMany({
          where: { phoneNormalized, isActive: true },
          include: { school: true },
        })
        if (candidates.length === 0) return null

        // Prefer ACTIVE accounts in active schools; newest first.
        const usable = candidates
          .filter((u) => (u.status || "ACTIVE") === "ACTIVE")
          .filter((u) => !u.school || u.school.isActive)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        const user = usable[0]
        if (!user) {
          console.log(`[auth] login blocked for ${maskPhone(phoneNormalized)} (no ACTIVE account)`)
          return null
        }

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        const extraRoles = await getExtraRoles(user.id, user.role).catch(() => [] as string[])

        return {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          role: user.role,
          extraRoles,
          schoolId: user.schoolId!,
          school: user.school,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as SessionUser
        token.id = u.id
        token.email = u.email
        token.phone = u.phone
        token.name = u.name
        token.role = u.role
        token.extraRoles = u.extraRoles || []
        token.schoolId = u.schoolId
        token.school = u.school
        token.mustChangePassword = u.mustChangePassword
        if (u.id) {
          const permissions = await getUserPermissions(u.id)
          token.permissions = permissions
          token.permissionsRefreshAt = Date.now()
        }
      }

      // Refresh permissions every 5 minutes (not on every request)
      const refreshAt = (token as unknown as Record<string, unknown>).permissionsRefreshAt as
        | number
        | undefined
      const userId = token.id as string | undefined
      if (userId && (!refreshAt || Date.now() - refreshAt > 5 * 60 * 1000)) {
        const permissions = await getUserPermissions(userId)
        token.permissions = permissions
        ;(token as unknown as Record<string, unknown>).permissionsRefreshAt = Date.now()
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as unknown as SessionUser & { permissions?: string[] }
        session.user.id = t.id as string
        session.user.email = (t.email as string | null) ?? null
        session.user.phone = (t.phone as string | null) ?? null
        session.user.role = t.role as string
        session.user.extraRoles = (t.extraRoles as string[]) || []
        session.user.schoolId = t.schoolId as string | null
        session.user.school = t.school as SessionUser["school"]
        session.user.permissions = (t.permissions as string[]) || []
        session.user.mustChangePassword = (t.mustChangePassword as boolean) || false
      }
      return session
    },
  },
}
