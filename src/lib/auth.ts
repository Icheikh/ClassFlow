import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { getUserPermissions } from "./permissions"

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const rawId = String(credentials.email).trim()
        const phoneDigits = rawId.replace(/\D/g, "")
        const isPhone = phoneDigits.length >= 8

        let user = await prisma.user.findUnique({
          where: { email: rawId },
          include: { school: true },
        })
        if (!user && isPhone) {
          user = await prisma.user.findFirst({
            where: {
              OR: [
                { phone: rawId },
                { phone: `+${phoneDigits}` },
                { email: `${phoneDigits}@classflow.phone` },
                { email: `p${phoneDigits}@alfath.classflow` },
                { email: `p${phoneDigits}@alnoor.classflow` },
                { email: { contains: phoneDigits } },
              ],
            },
            include: { school: true },
          })
        }

        if (!user || !user.isActive) return null
        if (user.school && !user.school.isActive) return null

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
        token.role = u.role
        token.schoolId = u.schoolId
        token.school = u.school
        token.mustChangePassword = u.mustChangePassword
        if (u.id) {
          const permissions = await getUserPermissions(u.id)
          token.permissions = permissions
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as unknown as SessionUser & { permissions?: string[] }
        session.user.id = t.id as string
        session.user.role = t.role as string
        session.user.schoolId = t.schoolId as string | null
        session.user.school = t.school as SessionUser["school"]
        session.user.permissions = (t.permissions as string[]) || []
        session.user.mustChangePassword = (t.mustChangePassword as boolean) || false
      }
      return session
    },
  },
}