import "next-auth"

declare module "next-auth" {
  interface User {
    role: string
    schoolId?: string | null
    school?: {
      id: string
      name: string
      slug: string
    } | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      schoolId?: string | null
      school?: {
        id: string
        name: string
        slug: string
      } | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    schoolId?: string | null
    school?: {
      id: string
      name: string
      slug: string
    } | null
  }
}