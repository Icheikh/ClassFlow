"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Badge, Card, LoadingPage, Select } from "@/components/ui"
import { GraduationCap, TrendingUp } from "lucide-react"

type Child = { id: string; firstName: string; lastName: string }
type SubjectResult = {
  subjectId: string
  subjectName: string
  average: number | null
  grades: { label: string; score: number; maxScore: number; assessmentType: string; date: string }[]
}
type ChildGrades = {
  studentId: string
  average: number | null
  subjects: SubjectResult[]
}

export default function ParentGradesPage() {
  const t = useTranslations("parentPage")
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState("")
  const [gradesData, setGradesData] = useState<ChildGrades | null>(null)
  const [termName, setTermName] = useState("")

  useEffect(() => {
    async function load() {
      const { data } = await api.get<{ children: Child[] }>("/api/parent/children")
      if (data?.children) {
        setChildren(data.children)
        if (data.children[0]) setSelectedChild(data.children[0].id)
      }
      setLoading(false)
    }
    void load()
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    async function load() {
      const { data } = await api.get<{ children: ChildGrades[]; term: { name: string } }>(
        `/api/parent/grades?studentId=${selectedChild}`
      )
      if (data) {
        const childGrades = data.children.find((c) => c.studentId === selectedChild)
        setGradesData(childGrades || null)
        setTermName(data.term?.name || "")
      }
    }
    void load()
  }, [selectedChild])

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">النتائج الدراسية</h1>
        <p className="text-sm text-gray-500">معدلات أبنائك وتفاصيل نتائجهم{termName ? ` — ${termName}` : ""}</p>
      </div>

      {children.length > 1 && (
        <Card padding="md">
          <Select
            label="اختر الابن"
            value={selectedChild}
            onChange={setSelectedChild}
            options={children.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
          />
        </Card>
      )}

      {gradesData && (
        <>
          <Card padding="lg">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">المعدل العام</p>
                <p className="text-3xl font-bold text-blue-700">
                  {gradesData.average != null ? gradesData.average.toFixed(2) : "—"}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">النتائج حسب المادة</h2>
            </div>
            {gradesData.subjects.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">لا توجد نتائج مسجلة بعد</p>
            ) : (
              <div className="space-y-3">
                {gradesData.subjects.map((subject) => (
                  <div key={subject.subjectId} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{subject.subjectName}</p>
                        <p className="text-sm text-gray-500">{subject.grades.length} نتيجة مسجلة</p>
                      </div>
                      <div className="text-left">
                        {subject.average != null ? (
                          <Badge variant={subject.average >= 14 ? "success" : subject.average >= 10 ? "warning" : "danger"}>
                            {subject.average.toFixed(2)}
                          </Badge>
                        ) : (
                          <Badge variant="default">—</Badge>
                        )}
                      </div>
                    </div>
                    {subject.grades.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {subject.grades.map((grade, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                            <div>
                              <span className="font-medium">{grade.label}</span>
                              <span className="mr-2 text-gray-400">
                                {grade.assessmentType === "TEST" ? "فرض" : "امتحان"}
                              </span>
                            </div>
                            <span className={`font-semibold ${grade.score >= grade.maxScore * 0.5 ? "text-green-700" : "text-red-700"}`}>
                              {grade.score}/{grade.maxScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
