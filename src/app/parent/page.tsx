import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { getRequestLocale } from "@/i18n/getRequestLocale"
import { getLocaleDirection } from "@/i18n/config"

export default async function ParentPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  const locale = await getRequestLocale()
  const dir = getLocaleDirection(locale)
  const t = await getTranslations("parentPage")

  if (!session) {
    redirect("/auth/login")
  }

  if (user?.role !== "PARENT") {
    redirect("/school")
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6" dir={dir}>
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 shadow-sm">
        <p className="text-sm text-green-600">{t("role")}</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-3 text-gray-600">{t("description")}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">{t("absences")}</p>
            <p className="mt-2 font-medium text-gray-900">{t("absencesHint")}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">{t("results")}</p>
            <p className="mt-2 font-medium text-gray-900">{t("resultsHint")}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">{t("notifications")}</p>
            <p className="mt-2 font-medium text-gray-900">{t("notificationsHint")}</p>
          </div>
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
