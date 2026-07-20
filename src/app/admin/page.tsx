import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { getRequestLocale } from "@/i18n/getRequestLocale"
import { getLocaleDirection } from "@/i18n/config"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  const locale = await getRequestLocale()
  const dir = getLocaleDirection(locale)
  const t = await getTranslations("adminPage")

  if (!session) {
    redirect("/auth/login")
  }

  if (user?.role !== "SUPER_ADMIN") {
    redirect("/school")
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6" dir={dir}>
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 shadow-sm">
        <p className="text-sm text-blue-600">{t("role")}</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-3 text-gray-600">{t("description")}</p>

        <div className="mt-8 rounded-xl bg-gray-50 p-5">
          <p className="font-medium text-gray-900">{t("statusTitle")}</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>{t("status1")}</li>
            <li>{t("status2")}</li>
            <li>{t("status3")}</li>
          </ul>
        </div>

        <div className="mt-6">
          <Link href="/auth/login" className="text-sm font-medium text-blue-700 hover:underline">
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    </main>
  )
}
