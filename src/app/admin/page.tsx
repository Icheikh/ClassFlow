"use client"

import { useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Button, Card, LoadingPage } from "@/components/ui"
import {
  Building2, Power, Users, GraduationCap, School, Plus,
  ChevronLeft, ChevronRight, Crown, Globe2, ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { getLocaleDirection } from "@/i18n/config"

type SchoolRow = {
  id: string
  name: string
  slug: string
  subscriptionStatus: string
  isActive: boolean
  studentCount: number
  admin: { email: string; name: string } | null
}

type AdminStats = {
  totalSchools: number
  activeSchools: number
  trialSchools: number
  totalUsers: number
  totalStudents: number
  totalTeachers: number
}

const statusTone: Record<string, "success" | "warning" | "danger" | "default"> = {
  TRIAL: "warning",
  ACTIVE: "success",
  EXPIRED: "danger",
  CANCELLED: "default",
}

export default function AdminDashboard() {
  const t = useTranslations("adminPage")
  const tNav = useTranslations("adminNav")
  const locale = useLocale()
  const direction = getLocaleDirection(locale)
  const isRtl = direction === "rtl"
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentSchools, setRecentSchools] = useState<SchoolRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [statsRes, schoolsRes] = await Promise.all([
        api.get<AdminStats>("/api/admin/stats"),
        api.get<SchoolRow[]>("/api/admin/schools"),
      ])
      setStats(statsRes.data)
      setRecentSchools((schoolsRes.data || []).slice(0, 5))
      setLoading(false)
    }
    void load()
  }, [])

  if (loading) return <LoadingPage />

  const Chevron = isRtl ? ChevronLeft : ChevronRight

  const statCards = [
    { label: t("totalSchools"), value: stats?.totalSchools ?? 0, icon: School, tone: "bg-blue-50 text-blue-600" },
    { label: t("activeSchools"), value: stats?.activeSchools ?? 0, icon: Power, tone: "bg-emerald-50 text-emerald-600" },
    { label: t("trialSchools"), value: stats?.trialSchools ?? 0, icon: Building2, tone: "bg-amber-50 text-amber-600" },
    { label: t("totalUsers"), value: stats?.totalUsers ?? 0, icon: Users, tone: "bg-violet-50 text-violet-600" },
    { label: t("totalStudents"), value: stats?.totalStudents ?? 0, icon: GraduationCap, tone: "bg-cyan-50 text-cyan-600" },
    { label: t("totalTeachers"), value: stats?.totalTeachers ?? 0, icon: ShieldCheck, tone: "bg-rose-50 text-rose-600" },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                <Crown className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-indigo-700">{t("role")}</p>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{tNav("dashboard")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("description")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("totalSchools")}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.totalSchools ?? 0}</p>
            </div>
            <Link href="/admin/schools">
              <Button>
                <Plus className="h-5 w-5" /> {t("addSchool")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.label} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
              </div>
              <div className={`rounded-lg p-3 ${card.tone}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card padding="lg">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="text-lg font-semibold">{tNav("schools")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("recentSchoolsHint")}</p>
            </div>
          </div>
          <Link href="/admin/schools" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
            {tNav("allSchools")} <Chevron className="h-4 w-4" />
          </Link>
        </div>

        {recentSchools.length === 0 ? (
          <div className="py-14 text-center">
            <School className="mx-auto mb-4 h-14 w-14 text-gray-200" />
            <p className="text-lg text-gray-500">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-gray-400">{t("emptyText")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right">
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("schoolName")}</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("adminAccount")}</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("studentsCount")}</th>
                  <th className="pb-3 font-medium text-gray-500">{t("subscription")}</th>
                </tr>
              </thead>
              <tbody>
                {recentSchools.map((school) => (
                  <tr key={school.id} className="border-b last:border-0 hover:bg-slate-50/60">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{school.name}</p>
                      <p className="text-xs text-gray-400" dir="ltr">{school.slug}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-gray-700">{school.admin?.name || "—"}</p>
                      <p className="text-xs text-gray-400" dir="ltr">{school.admin?.email || "—"}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{school.studentCount}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={school.isActive ? "success" : "danger"}>
                          {school.isActive ? t("active") : t("inactive")}
                        </Badge>
                        <Badge variant={statusTone[school.subscriptionStatus] || "default"}>
                          {t(`sub_${school.subscriptionStatus}`)}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}