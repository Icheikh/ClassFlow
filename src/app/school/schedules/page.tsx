"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, LoadingPage, Input, Pagination } from "@/components/ui"
import { School, Calendar } from "lucide-react"

type Classroom = {
  id: string
  name: string
  level: { name: string }
  stream: { name: string } | null
}

export default function SchedulesPage() {
  const t = useTranslations("schoolSchedules")
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const limit = 20
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await api.get<Classroom[]>("/api/school/classrooms")
      if (data) setClassrooms(data)
      else setError(error || t("loadError"))
      setLoading(false)
    }
    void load()
  }, [t])
  useEffect(() => { setPage(1) }, [search])

  const filtered = classrooms.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.level.name.toLowerCase().includes(search.toLowerCase())
  )
  const paginatedClassrooms = filtered.slice((page - 1) * limit, page * limit)
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / limit))
    if (page > maxPage) setPage(maxPage)
  }, [filtered.length, limit, page])

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b">
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {classrooms.length === 0 ? t("noClassrooms") : t("noResults")}
          </div>
        ) : (
          <div className="divide-y">
            {paginatedClassrooms.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <School className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.level.name}{c.stream ? ` - ${c.stream.name}` : ""}</p>
                  </div>
                </div>
                <Link href={`/school/classrooms/${c.id}/schedule`}>
                  <Button size="sm" variant="secondary">
                    <Calendar className="h-4 w-4" /> {t("viewSchedule")}
                  </Button>
                </Link>
              </div>
            ))}
            <div className="px-4 pb-4">
              <Pagination page={page} total={filtered.length} limit={limit} onChange={setPage} />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
