"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { SessionProvider } from "next-auth/react"
import { redirect, usePathname } from "next/navigation"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { getLocaleDirection } from "@/i18n/config"
import { LanguageSwitcher } from "@/components/ui"
import {
  LayoutDashboard, CalendarCheck, GraduationCap, Receipt, LogOut, UserCog, Menu, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>
}
const nav: NavItem[] = [
  { href: "/parent", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/parent/attendance", label: "الحضور والغياب", icon: CalendarCheck },
  { href: "/parent/grades", label: "النتائج", icon: GraduationCap },
  { href: "/parent/invoices", label: "الفواتير", icon: Receipt },
]

function ParentLayoutContent({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const direction = getLocaleDirection(locale)
  const isRtl = direction === "rtl"
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const user = session?.user as any
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!session || user?.role !== "PARENT") {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" dir={direction}>
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <h1 className="font-bold text-lg">ClassFlow</h1>
        <div className="w-8" />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-40 bg-white overflow-y-auto">
          <div className="p-3 space-y-1 pb-24">
            {nav.map((item) => {
              const active = item.href === "/parent" ? pathname === item.href : pathname?.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} onClick={closeMobile}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                  )}>
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
            <button type="button" onClick={() => void signOut({ callbackUrl: "/auth/login" })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full">
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}

      <aside className={cn("hidden lg:flex w-64 bg-white shadow-sm flex-col shrink-0", isRtl ? "border-l" : "border-r")}>
        <div className="p-5 border-b">
          <h1 className="text-xl font-bold text-gray-900">ClassFlow</h1>
          <div className="mt-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-green-600">ولي أمر</p>
          </div>
          <div className="mt-4 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = item.href === "/parent" ? pathname === item.href : pathname?.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                )}>
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t space-y-1">
          <button type="button" onClick={() => void signOut({ callbackUrl: "/auth/login" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors w-full">
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-4 pt-20 lg:px-8 lg:pt-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ParentLayoutContent>{children}</ParentLayoutContent>
    </SessionProvider>
  )
}
