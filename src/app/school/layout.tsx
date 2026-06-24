"use client"

import { useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import { redirect, usePathname } from "next/navigation"
import { roleLabels } from "@/lib/roles"
import {
  LayoutDashboard, Calendar, Layers, BookOpen, GraduationCap,
  Users, ClipboardList, Settings, LogOut, School, UserPlus, Wallet, Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

const allowedRoles = ["SCHOOL_ADMIN", "STAFF", "SUPERVISOR"]

type NavItem = {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean
}
const nav: NavItem[] = [
  { href: "/school", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/school/academic-years", label: "السنوات والفصول", icon: Calendar },
  { href: "/school/levels", label: "المستويات والشعب", icon: Layers },
  { href: "/school/classrooms", label: "الأقسام", icon: School },
  { href: "/school/subjects", label: "المواد والضوارب", icon: BookOpen },
  { href: "/school/teachers", label: "الأساتذة", icon: UserPlus },
  { href: "/school/payroll", label: "الرواتب", icon: Wallet },
  { href: "/school/students", label: "الطلاب", icon: Users },
  { href: "/school/staff", label: "الموظفون", icon: Shield, adminOnly: true },
  { href: "/school/settings", label: "الإعدادات", icon: Settings },
]

function SchoolLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const user = session?.user as any

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!session || !allowedRoles.includes(user?.role)) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      <aside className="w-64 bg-white border-l shadow-sm flex flex-col shrink-0">
        <div className="p-5 border-b">
          <h1 className="text-xl font-bold text-gray-900">ClassFlow</h1>
          <div className="mt-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-blue-600">{user.school?.name}</p>
            <p className="text-xs text-gray-400">{roleLabels[user.role]}</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.filter((item) => !item.adminOnly || user?.role === "SCHOOL_ADMIN").map((item) => {
            const active = pathname === item.href
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="p-3 border-t">
          <a href="/api/auth/signout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </a>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SchoolLayoutContent>{children}</SchoolLayoutContent>
    </SessionProvider>
  )
}