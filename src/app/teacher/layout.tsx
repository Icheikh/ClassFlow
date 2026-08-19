"use client"

import { signOut, useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import { redirect, usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  BookOpen,
  GraduationCap,
  LogOut,
  Menu,
  Users,
  Home,
  Calendar,
  UserCog,
} from "lucide-react"
import { getRoleLabel } from "@/lib/roles"
import { getLocaleDirection } from "@/i18n/config"
import { LanguageSwitcher } from "@/components/ui"
import { cn } from "@/lib/utils"

const allowedRoles = ["TEACHER"]

const navItems = [
  { href: "/teacher", labelKey: "home", icon: Home },
  { href: "/teacher/schedule", labelKey: "schedule", icon: Calendar },
  { href: "/teacher/attendance", labelKey: "attendance", icon: Users },
  { href: "/teacher/lessons", labelKey: "lessons", icon: BookOpen },
  { href: "/teacher/grades", labelKey: "grades", icon: GraduationCap },
]

function TeacherLayoutContent({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const direction = getLocaleDirection(locale)
  const isRtl = direction === "rtl"
  const tApp = useTranslations("app")
  const tTeacher = useTranslations("teacher")
  const tShell = useTranslations("shell")
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="sr-only">{tShell("loadingUser")}</span>
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
    <div className="min-h-screen bg-gray-50" dir={direction}>
      <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? tShell("menuClose") : tShell("menuOpen")} aria-expanded={mobileOpen}>
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="font-bold text-lg">{tApp("name")}</h1>
        <button onClick={() => signOut()} className="p-2 text-gray-500 hover:text-red-600">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50" aria-label={tShell("mainNavigation")}>
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={`flex flex-col items-center text-xs ${active ? "text-blue-600 font-medium" : "text-gray-500 hover:text-blue-600"}`} aria-current={active ? "page" : undefined}>
                <item.icon className="h-5 w-5" />
                <span className="mt-1">{tTeacher(item.labelKey)}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <aside className={cn(
        "hidden lg:flex fixed top-0 h-full w-64 bg-white shadow-sm",
        isRtl ? "right-0 border-l" : "left-0 border-r"
      )}>
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">{tApp("name")}</h1>
          </div>
          <div className="mb-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-gray-500">{getRoleLabel(user?.role, locale)}</p>
          </div>
          <div className="mb-6 flex justify-center">
            <LanguageSwitcher />
          </div>
          <nav className="space-y-1" aria-label={tShell("mainNavigation")}>
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"}`} aria-current={active ? "page" : undefined}>
                  <item.icon className="h-5 w-5" />
                  {tTeacher(item.labelKey)}
                </Link>
              )
            })}
            <Link href="/account" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100">
                <UserCog className="h-5 w-5" />
                {tShell("account")}
              </Link>
              <button onClick={() => signOut()} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 w-full mt-4">
              <LogOut className="h-5 w-5" />
              {tShell("logout")}
            </button>
          </nav>
        </div>
      </aside>

      <div className={cn("pb-16 lg:pb-0", isRtl ? "lg:mr-64" : "lg:ml-64")}>
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
