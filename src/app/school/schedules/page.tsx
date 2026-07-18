"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Card, LoadingPage, Input } from "@/components/ui"
import { Button } from "@/components/ui"
import { School, Calendar } from "lucide-react"

type Classroom = {
  id: string
  name: string
  level: { name: string }
  stream: { name: string } | null
}

export default function SchedulesPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function load() {
      const { data } = await api.get<{ classrooms: Classroom[] }>("/api/school/classrooms")
      if (data) setClassrooms(data.classrooms || [])
      setLoading(false)
    }
    void load()
  }, [])

  const filtered = classrooms.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.level.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">جدول الحصص</h1>
          <p className="text-sm text-gray-500">اختر قسماً لعرض أو تعديل جدول حصصه</p>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b">
          <Input
            placeholder="بحث عن قسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {classrooms.length === 0 ? "لا توجد أقسام مسجلة" : "لا توجد نتائج"}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((c) => (
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
                    <Calendar className="h-4 w-4" /> عرض الجدول
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
