"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ClipboardList,
  Eye,
  FilePenLine,
  GraduationCap,
  Lock,
  Plus,
  RefreshCcw,
  Trash2,
  UserSquare2,
  Users,
} from "lucide-react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { Badge, Button, Card, Input, LoadingPage, Modal } from "@/components/ui"
import { getTermAssessmentRequirements } from "@/lib/results"

type ClassroomResponse = {
  classroom: {
    id: string
    name: string
    capacity: number
    level: { id: string; name: string; stage: { name: string } }
    stream: { id: string; name: string } | null
  }
  enrollments: {
    id: string
    student: {
      id: string
      firstName: string
      lastName: string
      studentNumber: string | null
      phone: string | null
      isActive: boolean
    }
  }[]
  teacherAssignments: {
    id: string
    subject: { id: string; nameAr: string }
    teacher: { id: string; user: { name: string | null } }
  }[]
  recentLessons: {
    id: string
    title: string
    date: string
    subject: { nameAr: string }
    teacher: { user: { name: string | null } }
  }[]
  activeTerm: { id: string; name: string; order: number } | null
  resultPublication: {
    id: string
    status: string
    publishedAt: string | null
    lockedAt: string | null
  } | null
  assessments: {
    id: string
    title: string
    type: string
    date: string
    maxScore: number
    status: string
    subject: { id: string; nameAr: string }
    teacher: { user: { name: string | null } }
    scores: {
      id: string
      score: number
      student: {
        id: string
        firstName: string
        lastName: string
      }
    }[]
  }[]
  recentActivity: {
    id: string
    entityType: string
    action: string
    description: string
    createdAt: string
    actorUser: {
      id: string
      name: string | null
      email: string | null
    } | null
  }[]
  stats: {
    totalStudents: number
    totalTeachers: number
    presentToday: number
    absentToday: number
    assessmentCount: number
  }
}

type AssessmentForm = {
  id: string | null
  title: string
  subjectId: string
  assessmentType: string
  maxScore: string
  date: string
  scores: Record<string, string>
}

function formatDate(value: string | null | undefined) {
  if (!value) return "غير محدد"
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function getAssessmentTypeLabel(type: string) {
  if (type === "TEST") return "الاختبارات"
  if (type === "EXAM_1") return "الامتحان الأول"
  if (type === "EXAM_2") return "الامتحان الثاني"
  if (type === "EXAM_3") return "الامتحان الأخير"
  return type
}

function getPublicationStatus(status?: string | null) {
  if (status === "LOCKED") return { label: "مقفلة", variant: "danger" as const }
  if (status === "APPROVED") return { label: "معتمدة", variant: "warning" as const }
  return { label: "مفتوحة", variant: "success" as const }
}

function getAssessmentStatusVariant(status?: string | null) {
  if (status === "PUBLISHED") return "success" as const
  return "default" as const
}

function getActivityVariant(entityType: string) {
  if (entityType === "ASSESSMENT_OVERRIDE") return "danger" as const
  if (entityType === "RESULT_PUBLICATION") return "warning" as const
  return "info" as const
}

export default function ClassroomDetailsPage() {
  const params = useParams<{ id: string }>()
  const classroomId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [data, setData] = useState<ClassroomResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingAssessment, setSavingAssessment] = useState(false)
  const [deletingAssessmentId, setDeletingAssessmentId] = useState<string | null>(null)
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null)
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false)
  const [assessmentForm, setAssessmentForm] = useState<AssessmentForm>({
    id: null,
    title: "",
    subjectId: "",
    assessmentType: "TEST",
    maxScore: "20",
    date: new Date().toISOString().split("T")[0],
    scores: {},
  })

  const fetchData = useCallback(async () => {
    if (!classroomId) return
    setLoading(true)
    const { data: response, error } = await api.get<ClassroomResponse>(`/api/school/classrooms/${classroomId}`)
    if (error || !response) {
      toast.error(error || "تعذر تحميل بيانات القسم")
      setLoading(false)
      return
    }
    setData(response)
    setLoading(false)
  }, [classroomId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const subjectOptions = useMemo(() => {
    if (!data) return []
    return data.teacherAssignments.reduce<{ id: string; name: string; teacherName: string }[]>((items, assignment) => {
      if (items.some((item) => item.id === assignment.subject.id)) return items
      items.push({
        id: assignment.subject.id,
        name: assignment.subject.nameAr,
        teacherName: assignment.teacher.user.name || "أستاذ غير محدد",
      })
      return items
    }, [])
  }, [data])
  const assessmentTypeOptions = useMemo(() => {
    if (!data?.activeTerm) {
      return [{ value: "TEST", label: "الاختبارات" }]
    }

    return getTermAssessmentRequirements({
      testWeight: 3,
      exam1Weight: 1,
      exam2Weight: 2,
      exam3Weight: 3,
      denominator: 9,
      requireTest: true,
      requireExam1: true,
      requireExam2: true,
      requireExam3: true,
    }, data.activeTerm.order).map((item) => ({
      value: item.type,
      label: item.label,
    }))
  }, [data?.activeTerm])

  function buildEmptyScores() {
    const scores: Record<string, string> = {}
    for (const enrollment of data?.enrollments || []) {
      scores[enrollment.student.id] = ""
    }
    return scores
  }

  function resetAssessmentForm() {
    setAssessmentForm({
      id: null,
      title: "",
      subjectId: subjectOptions[0]?.id || "",
      assessmentType: "TEST",
      maxScore: "20",
      date: new Date().toISOString().split("T")[0],
      scores: buildEmptyScores(),
    })
  }

  function openCreateAssessment() {
    resetAssessmentForm()
    setAssessmentModalOpen(true)
  }

  function openEditAssessment(assessmentId: string) {
    const assessment = data?.assessments.find((item) => item.id === assessmentId)
    if (!assessment) return

    const nextScores = buildEmptyScores()
    for (const score of assessment.scores) {
      nextScores[score.student.id] = String(score.score)
    }

    setAssessmentForm({
      id: assessment.id,
      title: assessment.title,
      subjectId: assessment.subject.id,
      assessmentType: assessment.type,
      maxScore: String(assessment.maxScore),
      date: assessment.date.split("T")[0],
      scores: nextScores,
    })
    setAssessmentModalOpen(true)
  }

  async function saveAssessment() {
    if (!data) return
    if (!assessmentForm.title.trim() || !assessmentForm.subjectId || !assessmentForm.assessmentType) {
      toast.error("أكمل بيانات التقويم أولاً")
      return
    }

    const scores = Object.entries(assessmentForm.scores)
      .filter(([, score]) => score !== "")
      .map(([studentId, score]) => ({
        studentId,
        score: Number(score),
      }))

    if (scores.length === 0) {
      toast.error("أدخل نقطة طالب واحد على الأقل")
      return
    }

    const invalidScore = scores.find(({ score }) => !Number.isFinite(score) || score < 0 || score > Number(assessmentForm.maxScore))
    if (invalidScore) {
      toast.error("جميع النقاط يجب أن تكون أرقاماً بين 0 والدرجة القصوى")
      return
    }

    setSavingAssessment(true)
    const payload = {
      id: assessmentForm.id,
      title: assessmentForm.title.trim(),
      assessmentType: assessmentForm.assessmentType,
      classroomId: data.classroom.id,
      subjectId: assessmentForm.subjectId,
      termId: data.activeTerm?.id,
      maxScore: Number(assessmentForm.maxScore),
      date: assessmentForm.date,
      scores,
    }

    const result = assessmentForm.id
      ? await api.put("/api/grades", payload)
      : await api.post("/api/grades", payload)

    setSavingAssessment(false)
    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(assessmentForm.id ? "تم تعديل التقويم" : "تم إنشاء التقويم")
    setAssessmentModalOpen(false)
    await fetchData()
  }

  async function deleteAssessment(assessmentId: string) {
    if (!confirm("سيتم حذف هذا التقويم نهائيا. هل تريد المتابعة؟")) return

    setDeletingAssessmentId(assessmentId)
    const { error } = await api.delete(`/api/grades?id=${assessmentId}`)
    setDeletingAssessmentId(null)
    if (error) {
      toast.error(error)
      return
    }

    toast.success("تم حذف التقويم")
    await fetchData()
  }

  if (loading) return <LoadingPage />
  if (!data) {
    return (
      <Card>
        <div className="text-center py-12 space-y-3">
          <p className="text-lg font-semibold">تعذر تحميل القسم</p>
          <Button onClick={() => void fetchData()}>
            <RefreshCcw className="h-4 w-4" /> إعادة المحاولة
          </Button>
        </div>
      </Card>
    )
  }

  const publicationStatus = getPublicationStatus(data.resultPublication?.status)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Link href="/school/classrooms" className="inline-flex items-center gap-2 text-sm text-blue-700 hover:underline">
            <ArrowLeft className="h-4 w-4" /> العودة إلى الأقسام
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{data.classroom.name}</h1>
            <Badge variant="info">{data.classroom.level.stage.name}</Badge>
            <Badge>{data.classroom.level.name}</Badge>
            {data.classroom.stream && <Badge variant="warning">{data.classroom.stream.name}</Badge>}
          </div>
          <p className="text-sm text-gray-500">
            هذا العرض مخصص لمدير المدرسة لمعاينة التلاميذ والتقويمات والتعديلات الخاصة بهذا القسم من مكان واحد.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/school/students?classroomId=${data.classroom.id}`}>
            <Button variant="secondary">
              <Users className="h-4 w-4" /> كل تلاميذ القسم
            </Button>
          </Link>
          <Link href="/school/results">
            <Button variant="secondary">
              <GraduationCap className="h-4 w-4" /> النتائج
            </Button>
          </Link>
          <Button onClick={openCreateAssessment} disabled={subjectOptions.length === 0 || !data.activeTerm}>
            <Plus className="h-4 w-4" /> إضافة اختبار أو امتحان
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span>التلاميذ</span>
            <Users className="h-5 w-5" />
          </div>
          <p className="text-3xl font-bold">{data.stats.totalStudents}</p>
          <Link href={`/school/students?classroomId=${data.classroom.id}`} className="text-sm text-blue-700 hover:underline">
            عرض اللائحة الكاملة
          </Link>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span>التقويمات</span>
            <ClipboardList className="h-5 w-5" />
          </div>
          <p className="text-3xl font-bold">{data.stats.assessmentCount}</p>
          <p className="text-sm text-gray-500">اختبارات وامتحانات الفصل الحالي</p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span>حالة النتائج</span>
            <Lock className="h-5 w-5" />
          </div>
          <Badge variant={publicationStatus.variant} className="w-fit">
            {publicationStatus.label}
          </Badge>
          <p className="text-sm text-gray-500">
            {data.activeTerm ? `الفصل الحالي: ${data.activeTerm.name}` : "لا يوجد فصل نشط"}
          </p>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span>الحضور اليوم</span>
            <Calendar className="h-5 w-5" />
          </div>
          <p className="text-3xl font-bold">{data.stats.presentToday}</p>
          <p className="text-sm text-gray-500">غياب اليوم: {data.stats.absentToday}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">لائحة التلاميذ</h2>
              <p className="text-sm text-gray-500">الدخول إلى كل طالب يتم مباشرة من هذه اللائحة.</p>
            </div>
            <Link href={`/school/students?classroomId=${data.classroom.id}`}>
              <Button variant="ghost" size="sm">
                <Eye className="h-4 w-4" /> صفحة الطلاب
              </Button>
            </Link>
          </div>

          {data.enrollments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-gray-500">
              لا يوجد طلاب مسجلون في هذا القسم حالياً.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.enrollments.map((enrollment) => (
                <Link key={enrollment.id} href={`/school/students/${enrollment.student.id}`}>
                  <div className="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {enrollment.student.firstName} {enrollment.student.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {enrollment.student.studentNumber || "بدون رقم تسجيل"}
                        </p>
                      </div>
                      <Badge variant={enrollment.student.isActive ? "success" : "warning"}>
                        {enrollment.student.isActive ? "نشط" : "موقوف"}
                      </Badge>
                    </div>
                    {enrollment.student.phone && (
                      <p className="mt-2 text-sm text-gray-500">{enrollment.student.phone}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">مواد القسم</h2>
              <p className="text-sm text-gray-500">المواد المكلف بها الأساتذة لهذا القسم.</p>
            </div>

            {data.teacherAssignments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-gray-500">
                لا توجد تكليفات مواد لهذا القسم حتى الآن.
              </p>
            ) : (
              <div className="space-y-3">
                {data.teacherAssignments.map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{assignment.subject.nameAr}</p>
                        <p className="text-sm text-gray-500">{assignment.teacher.user.name || "أستاذ غير محدد"}</p>
                      </div>
                      <BookOpen className="h-5 w-5 text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">الدروس الأخيرة</h2>
              <p className="text-sm text-gray-500">آخر ما تم تسجيله داخل هذا القسم.</p>
            </div>

            {data.recentLessons.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-gray-500">
                لا توجد دروس مسجلة بعد.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentLessons.map((lesson) => (
                  <div key={lesson.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <p className="font-semibold">{lesson.title}</p>
                    <p className="text-sm text-gray-500">{lesson.subject.nameAr}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{lesson.teacher.user.name || "أستاذ غير محدد"}</span>
                      <span>{formatDate(lesson.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">الاختبارات والامتحانات</h2>
            <p className="text-sm text-gray-500">
              مدير المدرسة يرى جميع التقويمات ويمكنه تعديلها أو حذفها مع تسجيل ذلك في السجل. في كل فصل يوجد اختبار واحد على الأقل ويمكن إضافة أكثر من اختبار، مع امتحان ذلك الفصل فقط.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={publicationStatus.variant}>
              حالة النتائج: {publicationStatus.label}
            </Badge>
            <Button onClick={openCreateAssessment} disabled={subjectOptions.length === 0 || !data.activeTerm}>
              <Plus className="h-4 w-4" /> إضافة تقويم
            </Button>
          </div>
        </div>

        {data.assessments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-gray-500">
            لا توجد اختبارات أو امتحانات مسجلة لهذا القسم في الفصل الحالي.
          </p>
        ) : (
          <div className="space-y-4">
            {data.assessments.map((assessment) => (
              <div key={assessment.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{assessment.title}</h3>
                      <Badge variant="info">{getAssessmentTypeLabel(assessment.type)}</Badge>
                      <Badge variant={getAssessmentStatusVariant(assessment.status)}>{assessment.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                      <span>{assessment.subject.nameAr}</span>
                      <span>{assessment.teacher.user.name || "أستاذ غير محدد"}</span>
                      <span>{formatDate(assessment.date)}</span>
                      <span>الدرجة القصوى: {assessment.maxScore}</span>
                      <span>المدخلات: {assessment.scores.length}/{data.enrollments.length}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEditAssessment(assessment.id)}>
                      <FilePenLine className="h-4 w-4" /> تعديل
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deletingAssessmentId === assessment.id}
                      onClick={() => void deleteAssessment(assessment.id)}
                    >
                      <Trash2 className="h-4 w-4" /> حذف
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedAssessmentId((current) => current === assessment.id ? null : assessment.id)}
                    >
                      <Eye className="h-4 w-4" /> {expandedAssessmentId === assessment.id ? "إخفاء النقاط" : "عرض النقاط"}
                    </Button>
                  </div>
                </div>

                {expandedAssessmentId === assessment.id && (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">الطالب</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500">النقطة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {data.enrollments.map((enrollment) => {
                          const score = assessment.scores.find((item) => item.student.id === enrollment.student.id)
                          return (
                            <tr key={enrollment.student.id}>
                              <td className="px-4 py-3">
                                {enrollment.student.firstName} {enrollment.student.lastName}
                              </td>
                              <td className="px-4 py-3">
                                {score ? score.score : <span className="text-gray-400">غير مدخلة</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">سجل التتبع</h2>
          <p className="text-sm text-gray-500">كل تعديل على التقويمات أو حالة النتائج يظهر هنا للمدير.</p>
        </div>

        {data.recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-gray-500">
            لا توجد عمليات مسجلة حتى الآن.
          </p>
        ) : (
          <div className="space-y-3">
            {data.recentActivity.map((activity) => (
              <div key={activity.id} className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getActivityVariant(activity.entityType)}>
                        {activity.action}
                      </Badge>
                      <span className="font-medium">{activity.description}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {activity.actorUser?.name || activity.actorUser?.email || "مستخدم غير معروف"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <UserSquare2 className="h-4 w-4" />
                    <span>{formatDate(activity.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={assessmentModalOpen}
        onClose={() => setAssessmentModalOpen(false)}
        title={assessmentForm.id ? "تعديل تقويم" : "إضافة تقويم جديد"}
        className="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="عنوان التقويم"
              value={assessmentForm.title}
              onChange={(event) => setAssessmentForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="مثال: اختبار الشهر الأول"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">المادة</label>
              <select
                value={assessmentForm.subjectId}
                onChange={(event) => setAssessmentForm((current) => ({ ...current, subjectId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر المادة</option>
                {subjectOptions.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} - {subject.teacherName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">نوع التقويم</label>
              <select
                value={assessmentForm.assessmentType}
                onChange={(event) => setAssessmentForm((current) => ({ ...current, assessmentType: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assessmentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="الدرجة القصوى"
              type="number"
              min="1"
              step="0.01"
              value={assessmentForm.maxScore}
              onChange={(event) => setAssessmentForm((current) => ({ ...current, maxScore: event.target.value }))}
            />

            <Input
              label="التاريخ"
              type="date"
              value={assessmentForm.date}
              onChange={(event) => setAssessmentForm((current) => ({ ...current, date: event.target.value }))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">نقاط التلاميذ</h3>
                <p className="text-sm text-gray-500">كل النقاط تحتسب على 20 بعد التطبيع داخل النظام. في هذا الفصل يجب تسجيل اختبار واحد على الأقل ويمكن إضافة أكثر من اختبار.</p>
              </div>
              <Badge variant="info">
                التلاميذ: {data.enrollments.length}
              </Badge>
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-gray-100">
              <div className="grid grid-cols-1 divide-y divide-gray-100 bg-white">
                {data.enrollments.map((enrollment) => (
                  <div key={enrollment.student.id} className="grid grid-cols-[1fr_140px] items-center gap-4 px-4 py-3">
                    <div>
                      <p className="font-medium">
                        {enrollment.student.firstName} {enrollment.student.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {enrollment.student.studentNumber || "بدون رقم تسجيل"}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={assessmentForm.maxScore || "20"}
                      step="0.01"
                      value={assessmentForm.scores[enrollment.student.id] ?? ""}
                      onChange={(event) =>
                        setAssessmentForm((current) => ({
                          ...current,
                          scores: {
                            ...current.scores,
                            [enrollment.student.id]: event.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setAssessmentModalOpen(false)}>
              إلغاء
            </Button>
            <Button loading={savingAssessment} onClick={() => void saveAssessment()}>
              {assessmentForm.id ? "حفظ التعديلات" : "إنشاء التقويم"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
