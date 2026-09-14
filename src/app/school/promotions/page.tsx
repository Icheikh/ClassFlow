"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, Button, Select, Badge } from "@/components/ui"
import { ArrowUpCircle, Check } from "lucide-react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"

type AcademicYear = { id: string; name: string; isActive: boolean }
type Classroom = { id: string; name: string; level: { name: string }; stream?: { name: string } | null; _count?: { enrollments: number } }
type Student = { id: string; firstName: string; lastName: string; enrollments: { classroom: { name: string } }[] }

export default function PromotionsPage() {
  const t = useTranslations("promotions")
  const tCommon = useTranslations("common")

  const [years, setYears] = useState<AcademicYear[]>([])
  const [sourceYearId, setSourceYearId] = useState("")
  const [targetYearId, setTargetYearId] = useState("")
  const [sourceClassroomId, setSourceClassroomId] = useState("")
  const [targetClassroomId, setTargetClassroomId] = useState("")
  const [sourceClassrooms, setSourceClassrooms] = useState<Classroom[]>([])
  const [targetClassrooms, setTargetClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    api.get<AcademicYear[]>("/api/school/academic-years").then(({ data }) => {
      if (data) {
        setYears(data)
        const active = data.find((y) => y.isActive)
        if (active) setSourceYearId(active.id)
      }
    })
  }, [])

  useEffect(() => {
    if (!sourceYearId) { setSourceClassrooms([]); return }
    api.get<Classroom[]>(`/api/school/classrooms`).then(({ data }) => {
      if (data) setSourceClassrooms(data)
    })
  }, [sourceYearId])

  useEffect(() => {
    if (!targetYearId) { setTargetClassrooms([]); return }
    api.get<Classroom[]>(`/api/school/classrooms`).then(({ data }) => {
      if (data) setTargetClassrooms(data)
    })
  }, [targetYearId])

  useEffect(() => {
    if (!sourceClassroomId || !sourceYearId) { setStudents([]); return }
    setLoading(true)
    api.get<Student[]>(`/api/school/enrollments?classroomId=${sourceClassroomId}&academicYearId=${sourceYearId}&status=ACTIVE`).then(({ data }) => {
      if (data) setStudents(data.map((e: any) => ({ id: e.student.id, firstName: e.student.firstName, lastName: e.student.lastName, enrollments: [{ classroom: e.classroom }] })))
      setLoading(false)
    })
  }, [sourceClassroomId, sourceYearId])

  function toggleStudent(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(students.map((s) => s.id)))
  }

  async function promote() {
    if (!sourceClassroomId || !targetClassroomId || !targetYearId || selected.size === 0) {
      toast.error(t("selectSourceAndTarget"))
      return
    }
    setPromoting(true)
    const { data, error } = await api.post<{ promoted: number; skipped: number }>("/api/school/enrollments/promote", {
      sourceClassroomId,
      targetAcademicYearId: targetYearId,
      targetClassroomId,
      studentIds: Array.from(selected),
    })
    setPromoting(false)
    if (error || !data) { toast.error(error || "Failed"); return }
    toast.success(t("promoted", { count: data.promoted, skipped: data.skipped }))
    setSelected(new Set())
    setStudents([])
    setSourceClassroomId("")
  }

  const yearOptions = years.map((y) => ({ value: y.id, label: `${y.name}${y.isActive ? " (نشطة)" : ""}` }))
  const sourceClassroomOptions = sourceClassrooms.map((c) => ({
    value: c.id,
    label: `${c.level.name} - ${c.name}${c._count ? ` (${c._count.enrollments})` : ""}`,
  }))
  const targetClassroomOptions = targetClassrooms.map((c) => ({
    value: c.id,
    label: `${c.level.name} - ${c.name}${c._count ? ` (${c._count.enrollments})` : ""}`,
  }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ArrowUpCircle className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <Card padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">{t("sourceSection")}</h3>
            <Select
              label={t("academicYear")}
              value={sourceYearId}
              onChange={setSourceYearId}
              options={yearOptions}
              placeholder={t("selectYear")}
            />
            <Select
              label={t("classroom")}
              value={sourceClassroomId}
              onChange={setSourceClassroomId}
              options={sourceClassroomOptions}
              placeholder={t("selectClassroom")}
            />
          </div>
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">{t("targetSection")}</h3>
            <Select
              label={t("academicYear")}
              value={targetYearId}
              onChange={setTargetYearId}
              options={yearOptions.filter((y) => y.value !== sourceYearId)}
              placeholder={t("selectYear")}
            />
            <Select
              label={t("classroom")}
              value={targetClassroomId}
              onChange={setTargetClassroomId}
              options={targetClassroomOptions}
              placeholder={t("selectClassroom")}
            />
          </div>
        </div>

        {students.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">{t("studentsToPromote", { count: students.length })}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={selectAll}>{t("selectAll")}</Button>
                <span className="text-sm text-gray-500 self-center">{t("selected", { count: selected.size })}</span>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {students.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected.has(s.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm font-medium">{s.firstName} {s.lastName}</span>
                  {selected.has(s.id) && <Check className="h-4 w-4 text-blue-600 ms-auto" />}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={promote} disabled={promoting || selected.size === 0}>
                {promoting ? t("promoting") : t("promoteCount", { count: selected.size })}
              </Button>
            </div>
          </div>
        )}

        {sourceClassroomId && students.length === 0 && !loading && (
          <p className="text-center text-gray-400 mt-6">{t("noStudents")}</p>
        )}
      </Card>
    </div>
  )
}
