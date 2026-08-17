"use client"

import Link from "next/link"
import { signOut, useSession, SessionProvider } from "next-auth/react"
import { redirect, usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { getRoleLabel } from "@/lib/roles"
import { getLocaleDirection } from "@/i18n/config"
import { LanguageSwitcher } from "@/components/ui"
import { LayoutDashboard, Building2, LogOut, Home } from "lucide-react"
import { cn } from "@/lib/utils"

const allowedRoles = ["SUPER_ADMIN"]

type NavItem = {
  href: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}

const nav: NavItem[] = [
  { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/admin/schools", labelKey: "schools", icon: Building2 },
]

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const direction = getLocaleDirection(locale)
  const isRtl = direction === "rtl"
  const tShell = useTranslations("shell")
  const tApp = useTranslations("app")
  const tAdminNav = useTranslations("adminNav")
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const user = session?.user as any

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="sr-only">{tShell("loadingUser")}</span>
      </div>
    )
  }

  if (!session || !allowedRoles.includes(user?.role)) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" dir={direction}>
      <aside className={cn("w-64 bg-white shadow-sm flex flex-col shrink-0", isRtl ? "border-l" : "border-r")}>
        <div className="p-5 border-b">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">{tApp("name")}</h1>
          </div>
          <div className="mt-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-blue-600">{getRoleLabel(user.role, locale)}</p>
          </div>
          <div className="mt-4 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" />
                {tAdminNav(item.labelKey)}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Home className="h-5 w-5" />
            {tShell("home")}
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/auth/login" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="h-5 w-5" />
            {tShell("logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SessionProvider>
  )
}