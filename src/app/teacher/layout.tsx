"use client"

import { signOut, useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import { redirect, usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import {
  BookOpen,
  GraduationCap,
  LogOut,
  Menu,
  Users,
  Home,
} from "lucide-react"
import { roleLabels } from "@/lib/roles"

const allowedRoles = ["TEACHER"]

const navItems = [
  { href: "/teacher", label: "الرئيسية", icon: Home },
  { href: "/teacher/attendance", label: "الغياب", icon: Users },
  { href: "/teacher/lessons", label: "الدروس", icon: BookOpen },
  { href: "/teacher/grades", label: "النقاط", icon: GraduationCap },
]

function TeacherLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const user = session?.user as any
  if (!session) {
    redirect("/auth/login")
  }

  if (!allowedRoles.includes(user?.role)) {
    if (pathname === "/teacher/roster") {
      redirect("/school/teacher-attendance")
    }
    redirect("/school")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={mobileOpen}>
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="font-bold text-lg">ClassFlow</h1>
        <button onClick={() => signOut()} className="p-2 text-gray-500 hover:text-red-600">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50" aria-label="التنقل الرئيسي">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center text-xs ${active ? "text-blue-600 font-medium" : "text-gray-500 hover:text-blue-600"}`} aria-current={active ? "page" : undefined}>
                <item.icon className="h-5 w-5" />
                <span className="mt-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <aside className="hidden lg:flex fixed right-0 top-0 h-full w-64 bg-white border-l shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-8">ClassFlow</h1>
          <div className="mb-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-gray-500">{roleLabels[user?.role]}</p>
          </div>
          <nav className="space-y-1" aria-label="التنقل الرئيسي">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"}`} aria-current={active ? "page" : undefined}>
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
            <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 w-full mt-4">
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </button>
          </nav>
        </div>
      </aside>

      <div className="lg:mr-64 pb-16 lg:pb-0">
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <TeacherLayoutContent>{children}</TeacherLayoutContent>
    </SessionProvider>
  )
}
