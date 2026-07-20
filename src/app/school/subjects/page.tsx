"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Select, Badge, ConfirmModal } from "@/components/ui"
import { Plus, BookOpen, Edit2, Trash2, Hash, Layers, School, Filter, CalendarRange } from "lucide-react"
import toast from "react-hot-toast"
import { getLocalizedSubjectName } from "@/lib/locale"

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
  const locale = useLocale()
  const t = useTranslations("subjectsPage")
  const tCommon = useTranslations("common")
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
  const [coefficientToDelete, setCoefficientToDelete] = useState<CoefficientRule | null>(null)

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
    if (rule.classroom) return t("scopeClassroom", { name: rule.classroom.name })
    if (rule.stream) return `${rule.level.stage.name} - ${rule.level.name} - ${rule.stream.name}`
    return `${rule.level.stage.name} - ${rule.level.name}`
  }

  async function saveSubject() {
    if (!subjectNameAr.trim()) {
      toast.error(t("missingSubjectName"))
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

    toast.success(editingSubject ? t("subjectEditSuccess") : t("subjectCreateSuccess"))
    setShowSubjectModal(false)
    await fetchData()
  }

  async function saveCoefficient() {
    if (!coefficientSubjectId || !coefficientLevelId) {
      toast.error(t("missingSubjectLevel"))
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

    toast.success(editingCoefficient ? t("coefficientEditSuccess") : t("coefficientCreateSuccess"))
    setShowCoefficientModal(false)
    setEditingCoefficient(null)
    await fetchData()
  }

  async function deleteCoefficient(rule: CoefficientRule) {
    const { error } = await api.delete(`/api/school/subject-coefficients?id=${rule.id}`)
    setCoefficientToDelete(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(t("coefficientDeleteSuccess"))
    await fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
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
            <BookOpen className="h-5 w-5" /> {t("subjectCta")}
          </Button>
          <Button onClick={openCreateCoefficient}>
            <Hash className="h-5 w-5" /> {t("coefficientCta")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <CalendarRange className="h-4 w-4" />
            <span className="text-sm font-medium">{t("activeYear")}</span>
          </div>
          <p className="text-xl font-bold">{activeAcademicYear?.name || t("undefinedYear")}</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <Hash className="h-4 w-4" />
            <span className="text-sm font-medium">{t("visibleCoefficients")}</span>
          </div>
          <p className="text-xl font-bold">{visibleCoefficients.length}</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <School className="h-4 w-4" />
            <span className="text-sm font-medium">{t("classroomOverrides")}</span>
          </div>
          <p className="text-xl font-bold">{summary.classroomOverrides}</p>
        </Card>
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <Layers className="h-4 w-4" />
            <span className="text-sm font-medium">{t("coveredSubjects")}</span>
          </div>
          <p className="text-xl font-bold">{summary.subjectScoped}</p>
        </Card>
      </div>

      <Card padding="md">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Select
            label={t("filterBySubject")}
            value={subjectFilterId}
            onChange={setSubjectFilterId}
            options={[{ value: "", label: t("allSubjects") }, ...subjects.map((subject) => ({ value: subject.id, label: getLocalizedSubjectName(subject, locale) }))]}
            placeholder={t("allSubjects")}
          />
          <Select
            label={t("filterByLevel")}
            value={levelFilterId}
            onChange={setLevelFilterId}
            options={[{ value: "", label: t("allLevels") }, ...levels.map((level) => ({ value: level.id, label: `${level.stage.name} - ${level.name}` }))]}
            placeholder={t("allLevels")}
          />
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => { setSubjectFilterId(""); setLevelFilterId("") }}>
              <Filter className="h-4 w-4" /> {t("clearFilters")}
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={showSubjectModal} onClose={() => setShowSubjectModal(false)} title={editingSubject ? t("editSubject") : t("addSubject")}>
        <div className="space-y-4">
          <Input label={t("nameAr")} value={subjectNameAr} onChange={(e) => setSubjectNameAr(e.target.value)} placeholder="الرياضيات" />
          <Input label={t("nameFr")} value={subjectNameFr} onChange={(e) => setSubjectNameFr(e.target.value)} placeholder="Mathématiques" />
          <Input label={t("code")} value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="MATH" />
          <Button fullWidth onClick={() => void saveSubject()}>{t("save")}</Button>
        </div>
      </Modal>

      <Modal
        open={showCoefficientModal}
        onClose={() => {
          setShowCoefficientModal(false)
          setEditingCoefficient(null)
        }}
        title={editingCoefficient ? t("editCoefficient") : t("addCoefficient")}
      >
        <div className="space-y-4">
          <Select
            label={t("subjectLabel")}
            value={coefficientSubjectId}
            onChange={setCoefficientSubjectId}
            options={subjects.map((subject) => ({ value: subject.id, label: getLocalizedSubjectName(subject, locale) }))}
            placeholder={t("selectSubject")}
          />

          <Select
            label={t("levelLabel")}
            value={coefficientLevelId}
            onChange={(value) => {
              setCoefficientLevelId(value)
              setCoefficientStreamId("")
              setCoefficientClassroomId("")
            }}
            options={levels.map((level) => ({ value: level.id, label: `${level.stage.name} - ${level.name}` }))}
            placeholder={t("filterByLevel")}
          />

          {filteredStreams.length > 0 && (
            <Select
              label={t("streamLabel")}
              value={coefficientStreamId}
              onChange={setCoefficientStreamId}
              options={[
                { value: "", label: t("sharedForStreams") },
                ...filteredStreams.map((stream) => ({ value: stream.id, label: stream.name })),
              ]}
              placeholder={t("streamLabel")}
            />
          )}

          {filteredClassrooms.length > 0 && (
            <Select
              label={t("classroomOptionalLabel")}
              value={coefficientClassroomId}
              onChange={(value) => {
                setCoefficientClassroomId(value)
                const classroom = classrooms.find((item) => item.id === value)
                if (classroom?.stream?.id) setCoefficientStreamId(classroom.stream.id)
              }}
              options={[
                { value: "", label: t("generalForLevel") },
                ...filteredClassrooms.map((classroom) => ({ value: classroom.id, label: classroom.name })),
              ]}
              placeholder={t("selectClassroom")}
            />
          )}

          {selectedClassroom && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {t("specialClassroomNotice", { name: selectedClassroom.name })}
            </div>
          )}

          <Input
            label={t("coefficientLabel")}
            type="number"
            step="0.5"
            min="0.5"
            value={coefficientValue}
            onChange={(e) => setCoefficientValue(e.target.value)}
            placeholder="1"
          />

          <p className="text-xs text-gray-500">{t("priorityNote")}</p>

          <Button fullWidth onClick={() => void saveCoefficient()}>{t("save")}</Button>
        </div>
      </Modal>

      {loading ? (
        <Card>
          <p className="py-8 text-center text-gray-400">{t("loading")}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card padding="lg" className="lg:col-span-1">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <BookOpen className="h-5 w-5" /> {t("subjectsTitle")}
            </h3>
            {subjects.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noSubjects")}</p>
            ) : (
              <div className="space-y-2">
                {subjects.map((subject) => (
                  <div key={subject.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
                    <div>
                      <span className="font-medium">{getLocalizedSubjectName(subject, locale)}</span>
                      {subject.code && <span className={`${locale === "ar" ? "mr-2" : "ml-2"} text-xs text-gray-400`}>{subject.code}</span>}
                    </div>
                    <button
                      onClick={() => {
                        setEditingSubject(subject)
                        setSubjectNameAr(subject.nameAr)
                        setSubjectNameFr(subject.nameFr || "")
                        setSubjectCode(subject.code || "")
                        setShowSubjectModal(true)
                      }}
                      aria-label={t("editSubjectAria")}
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
                  <Hash className="h-5 w-5" /> {t("coefficientsTitle")}
                </h3>
                <p className="text-sm text-gray-500">{t("coefficientsSubtitle")}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">{t("generalBadge", { count: summary.levelSpecific })}</Badge>
                <Badge variant="info">{t("streamBadge", { count: summary.streamSpecific })}</Badge>
                <Badge variant="warning">{t("classroomBadge", { count: summary.classroomOverrides })}</Badge>
              </div>
            </div>

            {visibleCoefficients.length === 0 ? (
              <p className="text-sm text-gray-400">{t("noMatchingCoefficients")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className={`px-3 py-2 ${locale === "ar" ? "text-right" : "text-left"}`}>{t("subjectColumn")}</th>
                      <th className={`px-3 py-2 ${locale === "ar" ? "text-right" : "text-left"}`}>{t("scopeColumn")}</th>
                      <th className="px-3 py-2 text-center">{t("coefficientColumn")}</th>
                      <th className="px-3 py-2 text-center">{t("typeColumn")}</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCoefficients.map((rule) => (
                      <tr key={rule.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{getLocalizedSubjectName(rule.subject, locale)}</td>
                        <td className="px-3 py-2 text-gray-600">
                          <div className="flex items-center gap-2">
                            {rule.classroom ? <School className="h-4 w-4 text-blue-500" /> : <Layers className="h-4 w-4 text-gray-400" />}
                            <span>{getScopeLabel(rule)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{rule.coefficient}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={rule.classroom ? "warning" : rule.stream ? "info" : "default"}>
                            {rule.classroom ? t("classroomException") : rule.stream ? t("byStream") : t("general")}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-left">
                          <button onClick={() => openEditCoefficient(rule)} className={`${locale === "ar" ? "ml-2" : "mr-2"} text-gray-400 hover:text-blue-600`} aria-label={t("editCoefficientAria")}>
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => setCoefficientToDelete(rule)} className="text-red-400 hover:text-red-600" aria-label={t("deleteCoefficientAria")}>
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

      <ConfirmModal
        open={!!coefficientToDelete}
        onClose={() => setCoefficientToDelete(null)}
        onConfirm={() => void deleteCoefficient(coefficientToDelete!)}
        title={t("deleteTitle")}
        message={coefficientToDelete ? t("deleteMessage", { subject: getLocalizedSubjectName(coefficientToDelete.subject, locale) }) : ""}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        variant="danger"
      />
    </div>
  )
}
