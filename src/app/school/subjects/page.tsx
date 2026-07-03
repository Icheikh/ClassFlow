"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Select, Badge } from "@/components/ui"
import { Plus, BookOpen, Edit2, Trash2, Hash, Layers, School, Filter, CalendarRange } from "lucide-react"
import toast from "react-hot-toast"

type Subject = { id: string; nameAr: string; nameFr: string | null; code: string | null }
type Level = { id: string; name: string; stage: { name: string } }
type Stream = { id: string; name: string; levelId: string; code: string | null }
type Classroom = {
  id: string
  name: string
  level: { id: string; name: string; stage: { name: string } }
  stream: { id: string; name: string } | null
}
type CoefficientRule = {
  id: string
  coefficient: number
  subject: Subject
  level: Level
  stream: { id: string; name: string } | null
  classroom: Classroom | null
}
type CoefficientsResponse = {
  academicYear: { id: string; name: string } | null
  items: CoefficientRule[]
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [coefficients, setCoefficients] = useState<CoefficientRule[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [activeAcademicYear, setActiveAcademicYear] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [showCoefficientModal, setShowCoefficientModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [editingCoefficient, setEditingCoefficient] = useState<CoefficientRule | null>(null)

  const [subjectNameAr, setSubjectNameAr] = useState("")
  const [subjectNameFr, setSubjectNameFr] = useState("")
  const [subjectCode, setSubjectCode] = useState("")

  const [coefficientSubjectId, setCoefficientSubjectId] = useState("")
  const [coefficientLevelId, setCoefficientLevelId] = useState("")
  const [coefficientStreamId, setCoefficientStreamId] = useState("")
  const [coefficientClassroomId, setCoefficientClassroomId] = useState("")
  const [coefficientValue, setCoefficientValue] = useState("1")

  const [subjectFilterId, setSubjectFilterId] = useState("")
  const [levelFilterId, setLevelFilterId] = useState("")

  async function fetchData() {
    setLoading(true)

    const [subjectsRes, coefficientsRes, levelsRes, streamsRes, classroomsRes] = await Promise.all([
      api.get<Subject[]>("/api/school/subjects"),
      api.get<CoefficientsResponse>("/api/school/subject-coefficients"),
      api.get<Level[]>("/api/school/levels"),
      api.get<Stream[]>("/api/school/streams"),
      api.get<Classroom[]>("/api/school/classrooms"),
    ])

    if (subjectsRes.data) setSubjects(subjectsRes.data)
    if (coefficientsRes.data) {
      setActiveAcademicYear(coefficientsRes.data.academicYear)
      setCoefficients(coefficientsRes.data.items)
    }
    if (levelsRes.data) setLevels(levelsRes.data)
    if (streamsRes.data) setStreams(streamsRes.data)
    if (classroomsRes.data) setClassrooms(classroomsRes.data)

    setLoading(false)
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const filteredStreams = streams.filter((stream) => stream.levelId === coefficientLevelId)
  const filteredClassrooms = classrooms.filter((classroom) => classroom.level.id === coefficientLevelId)
  const selectedClassroom = classrooms.find((classroom) => classroom.id === coefficientClassroomId) || null

  const visibleCoefficients = useMemo(() => {
    return coefficients.filter((rule) => {
      if (subjectFilterId && rule.subject.id !== subjectFilterId) return false
      if (levelFilterId && rule.level.id !== levelFilterId) return false
      return true
    })
  }, [coefficients, levelFilterId, subjectFilterId])

  const summary = useMemo(() => {
    const subjectScoped = new Set(visibleCoefficients.map((rule) => rule.subject.id)).size
    const classroomOverrides = visibleCoefficients.filter((rule) => rule.classroom).length
    const streamSpecific = visibleCoefficients.filter((rule) => !rule.classroom && rule.stream).length
    const levelSpecific = visibleCoefficients.filter((rule) => !rule.classroom && !rule.stream).length

    return {
      subjectScoped,
      classroomOverrides,
      streamSpecific,
      levelSpecific,
    }
  }, [visibleCoefficients])

  function resetCoefficientForm() {
    setCoefficientSubjectId("")
    setCoefficientLevelId("")
    setCoefficientStreamId("")
    setCoefficientClassroomId("")
    setCoefficientValue("1")
    setEditingCoefficient(null)
  }

  function openCreateCoefficient() {
    resetCoefficientForm()
    setShowCoefficientModal(true)
  }

  function openEditCoefficient(rule: CoefficientRule) {
    setEditingCoefficient(rule)
    setCoefficientSubjectId(rule.subject.id)
    setCoefficientLevelId(rule.classroom?.level.id || rule.level.id)
    setCoefficientStreamId(rule.classroom?.stream?.id || rule.stream?.id || "")
    setCoefficientClassroomId(rule.classroom?.id || "")
    setCoefficientValue(String(rule.coefficient))
    setShowCoefficientModal(true)
  }

  function getScopeLabel(rule: CoefficientRule) {
    if (rule.classroom) {
      return `استثناء خاص بالقسم ${rule.classroom.name}`
    }
    if (rule.stream) {
      return `${rule.level.stage.name} - ${rule.level.name} - ${rule.stream.name}`
    }
    return `${rule.level.stage.name} - ${rule.level.name}`
  }

  async function saveSubject() {
    if (!subjectNameAr.trim()) {
      toast.error("يرجى إدخال اسم المادة")
      return
    }

    const { error } = editingSubject
      ? await api.put("/api/school/subjects", {
          id: editingSubject.id,
          nameAr: subjectNameAr.trim(),
          nameFr: subjectNameFr.trim(),
          code: subjectCode.trim(),
        })
      : await api.post("/api/school/subjects", {
          nameAr: subjectNameAr.trim(),
          nameFr: subjectNameFr.trim(),
          code: subjectCode.trim(),
        })

    if (error) {
      toast.error(error)
      return
    }

    toast.success(editingSubject ? "تم تعديل المادة" : "تمت إضافة المادة")
    setShowSubjectModal(false)
    await fetchData()
  }

  async function saveCoefficient() {
    if (!coefficientSubjectId || !coefficientLevelId) {
      toast.error("يرجى اختيار المادة والمستوى")
      return
    }

    const payload = {
      subjectId: coefficientSubjectId,
      levelId: coefficientLevelId,
      streamId: coefficientStreamId || undefined,
      classroomId: coefficientClassroomId || undefined,
      coefficient: coefficientValue,
    }

    const { error } = editingCoefficient
      ? await api.put("/api/school/subject-coefficients", {
          id: editingCoefficient.id,
          ...payload,
        })
      : await api.post("/api/school/subject-coefficients", payload)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(editingCoefficient ? "تم تعديل الضارب" : "تم حفظ الضارب")
    setShowCoefficientModal(false)
    setEditingCoefficient(null)
    await fetchData()
  }

  async function deleteCoefficient(rule: CoefficientRule) {
    if (!confirm(`سيتم حذف ضارب ${rule.subject.nameAr}. هل تريد المتابعة؟`)) return

    const { error } = await api.delete(`/api/school/subject-coefficients?id=${rule.id}`)
    if (error) {
      toast.error(error)
      return
    }

    toast.success("تم حذف الضارب")
    await fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المواد والضوارب</h1>
          <p className="text-sm text-gray-500">
            الضارب لا يثبت داخل المادة نفسها، بل يحدد حسب المستوى أو الشعبة أو كاستثناء خاص بالقسم.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setEditingSubject(null)
              setSubjectNameAr("")
              setSubjectNameFr("")
              setSubjectCode("")
              setShowSubjectModal(true)
            }}
          >
            <BookOpen className="h-5 w-5" /> مادة
          </Button>
          <Button onClick={openCreateCoefficient}>
            <Hash className="h-5 w-5" /> ضارب
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <CalendarRange className="h-4 w-4" />
            <span className="text-sm font-medium">السنة النشطة</span>
          </div>
          <p className="text-xl font-bold">{activeAcademicYear?.name || "غير محددة"}</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <Hash className="h-4 w-4" />
            <span className="text-sm font-medium">الضوارب المعروضة</span>
          </div>
          <p className="text-xl font-bold">{visibleCoefficients.length}</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <School className="h-4 w-4" />
            <span className="text-sm font-medium">استثناءات الأقسام</span>
          </div>
          <p className="text-xl font-bold">{summary.classroomOverrides}</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <Layers className="h-4 w-4" />
            <span className="text-sm font-medium">مواد مغطاة</span>
          </div>
          <p className="text-xl font-bold">{summary.subjectScoped}</p>
        </Card>
      </div>

      <Card padding="md">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Select
            label="تصفية حسب المادة"
            value={subjectFilterId}
            onChange={setSubjectFilterId}
            options={[{ value: "", label: "كل المواد" }, ...subjects.map((subject) => ({ value: subject.id, label: subject.nameAr }))]}
            placeholder="كل المواد"
          />
          <Select
            label="تصفية حسب المستوى"
            value={levelFilterId}
            onChange={setLevelFilterId}
            options={[{ value: "", label: "كل المستويات" }, ...levels.map((level) => ({ value: level.id, label: `${level.stage.name} - ${level.name}` }))]}
            placeholder="كل المستويات"
          />
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => { setSubjectFilterId(""); setLevelFilterId("") }}>
              <Filter className="h-4 w-4" /> مسح التصفية
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title={editingSubject ? "تعديل مادة" : "إضافة مادة"}
      >
        <div className="space-y-4">
          <Input label="الاسم (عربي)" value={subjectNameAr} onChange={(e) => setSubjectNameAr(e.target.value)} placeholder="الرياضيات" />
          <Input label="الاسم (فرنسي)" value={subjectNameFr} onChange={(e) => setSubjectNameFr(e.target.value)} placeholder="Mathématiques" />
          <Input label="الرمز" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="MATH" />
          <Button fullWidth onClick={() => void saveSubject()}>
            حفظ
          </Button>
        </div>
      </Modal>

      <Modal
        open={showCoefficientModal}
        onClose={() => {
          setShowCoefficientModal(false)
          setEditingCoefficient(null)
        }}
        title={editingCoefficient ? "تعديل ضارب" : "إضافة ضارب"}
      >
        <div className="space-y-4">
          <Select
            label="المادة"
            value={coefficientSubjectId}
            onChange={setCoefficientSubjectId}
            options={subjects.map((subject) => ({ value: subject.id, label: subject.nameAr }))}
            placeholder="اختر المادة"
          />

          <Select
            label="المستوى"
            value={coefficientLevelId}
            onChange={(value) => {
              setCoefficientLevelId(value)
              setCoefficientStreamId("")
              setCoefficientClassroomId("")
            }}
            options={levels.map((level) => ({ value: level.id, label: `${level.stage.name} - ${level.name}` }))}
            placeholder="اختر المستوى"
          />

          {filteredStreams.length > 0 && (
            <Select
              label="الشعبة"
              value={coefficientStreamId}
              onChange={setCoefficientStreamId}
              options={[
                { value: "", label: "ضارب مشترك لكل شعب هذا المستوى" },
                ...filteredStreams.map((stream) => ({ value: stream.id, label: stream.name })),
              ]}
              placeholder="اختر الشعبة"
            />
          )}

          {filteredClassrooms.length > 0 && (
            <Select
              label="قسم خاص (اختياري)"
              value={coefficientClassroomId}
              onChange={(value) => {
                setCoefficientClassroomId(value)
                const classroom = classrooms.find((item) => item.id === value)
                if (classroom?.stream?.id) {
                  setCoefficientStreamId(classroom.stream.id)
                }
              }}
              options={[
                { value: "", label: "ضارب عام للمستوى أو الشعبة" },
                ...filteredClassrooms.map((classroom) => ({ value: classroom.id, label: classroom.name })),
              ]}
              placeholder="اختر القسم"
            />
          )}

          {selectedClassroom && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              سيتم حفظ هذا كاستثناء خاص بالقسم <span className="font-semibold">{selectedClassroom.name}</span>
            </div>
          )}

          <Input
            label="الضارب"
            type="number"
            step="0.5"
            min="0.5"
            value={coefficientValue}
            onChange={(e) => setCoefficientValue(e.target.value)}
            placeholder="1"
          />

          <p className="text-xs text-gray-500">
            الأولوية في الحساب: ضارب القسم الخاص ثم ضارب الشعبة ثم ضارب المستوى العام.
          </p>

          <Button fullWidth onClick={() => void saveCoefficient()}>
            حفظ
          </Button>
        </div>
      </Modal>

      {loading ? (
        <Card>
          <p className="py-8 text-center text-gray-400">جاري التحميل...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card padding="lg" className="lg:col-span-1">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <BookOpen className="h-5 w-5" /> المواد
            </h3>
            {subjects.length === 0 ? (
              <p className="text-sm text-gray-400">لا توجد مواد بعد</p>
            ) : (
              <div className="space-y-2">
                {subjects.map((subject) => (
                  <div key={subject.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
                    <div>
                      <span className="font-medium">{subject.nameAr}</span>
                      {subject.code && <span className="mr-2 text-xs text-gray-400">{subject.code}</span>}
                    </div>
                    <button
                      onClick={() => {
                        setEditingSubject(subject)
                        setSubjectNameAr(subject.nameAr)
                        setSubjectNameFr(subject.nameFr || "")
                        setSubjectCode(subject.code || "")
                        setShowSubjectModal(true)
                      }}
                    >
                      <Edit2 className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding="lg" className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Hash className="h-5 w-5" /> الضوارب
                </h3>
                <p className="text-sm text-gray-500">
                  الإدارة هنا تخص السنة النشطة فقط حتى لا تختلط ضوارب السنوات ببعضها.
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">عام: {summary.levelSpecific}</Badge>
                <Badge variant="info">شعب: {summary.streamSpecific}</Badge>
                <Badge variant="warning">أقسام: {summary.classroomOverrides}</Badge>
              </div>
            </div>

            {visibleCoefficients.length === 0 ? (
              <p className="text-sm text-gray-400">
                لا توجد ضوارب مطابقة للتصفية الحالية. أضف ضارباً عاماً للمستوى أو الشعبة ثم أضف استثناءات خاصة بالأقسام عند الحاجة.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="px-3 py-2 text-right">المادة</th>
                      <th className="px-3 py-2 text-right">النطاق</th>
                      <th className="px-3 py-2 text-center">الضارب</th>
                      <th className="px-3 py-2 text-center">النوع</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCoefficients.map((rule) => (
                      <tr key={rule.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{rule.subject.nameAr}</td>
                        <td className="px-3 py-2 text-gray-600">
                          <div className="flex items-center gap-2">
                            {rule.classroom ? <School className="h-4 w-4 text-blue-500" /> : <Layers className="h-4 w-4 text-gray-400" />}
                            <span>{getScopeLabel(rule)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{rule.coefficient}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={rule.classroom ? "warning" : rule.stream ? "info" : "default"}>
                            {rule.classroom ? "استثناء قسم" : rule.stream ? "حسب الشعبة" : "عام"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-left">
                          <button onClick={() => openEditCoefficient(rule)} className="ml-2 text-gray-400 hover:text-blue-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => void deleteCoefficient(rule)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
