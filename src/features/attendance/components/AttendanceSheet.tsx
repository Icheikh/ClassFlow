import { useState } from "react"
import { useClasses } from "@/hooks/useClasses"
import { useStudents } from "@/hooks/useStudents"
import { attendanceApi } from "@/lib/api"
import { Button, Card, Select, Badge, LoadingSpinner } from "@/components/ui"
import { Check, X, Clock, AlertCircle, Save } from "lucide-react"
import toast from "react-hot-toast"

type AttendanceStatus = "present" | "absent" | "late" | "excused"

const STATUS_CYCLE: AttendanceStatus[] = ["present", "absent", "late", "excused"]

const STATUS_CONFIG: Record<AttendanceStatus, { icon: any; variant: "success" | "danger" | "warning" | "info"; label: string }> = {
  present: { icon: Check, variant: "success", label: "حاضر" },
  absent: { icon: X, variant: "danger", label: "غائب" },
  late: { icon: Clock, variant: "warning", label: "متأخر" },
  excused: { icon: AlertCircle, variant: "info", label: "بعذر" },
}

export function AttendanceSheet() {
  const { classrooms, getSubjects, loading: loadingClasses } = useClasses()
  const [classroomId, setClassroomId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const { students } = useStudents(classroomId)
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)

  function getStatus(studentId: string): AttendanceStatus {
    return records[studentId] || "present"
  }

  function toggle(studentId: string) {
    const current = getStatus(studentId)
    const idx = STATUS_CYCLE.indexOf(current)
    setRecords({ ...records, [studentId]: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] })
  }

  async function save() {
    setSaving(true)
    const result = await attendanceApi.save({
      classroomId,
      subjectId,
      date: new Date().toISOString().split("T")[0],
      records: students.map((s) => ({ studentId: s.id, status: getStatus(s.id) })),
    })
    if (result.error) toast.error(result.error)
    else toast.success("تم حفظ الغياب وإرسال الإشعارات")
    setSaving(false)
  }

  if (loadingClasses) return <LoadingSpinner message="جاري تحميل البيانات..." />

  const absentCount = students.filter((s) => getStatus(s.id) !== "present").length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">دفتر الغياب</h1>
        {absentCount > 0 && (
          <Badge variant="danger">{absentCount} غائب</Badge>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <Select
          value={classroomId}
          onChange={(v) => { setClassroomId(v); setSubjectId("") }}
          options={classrooms.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="اختر القسم"
        />
        {classroomId && (
          <Select
            value={subjectId}
            onChange={setSubjectId}
            options={getSubjects(classroomId).map((s) => ({ value: s.id, label: s.name }))}
            placeholder="اختر المادة"
          />
        )}
      </div>

      {subjectId && (
        <>
          <Card padding="sm" className="mb-4">
            <p className="text-sm text-gray-500">
              التاريخ: {new Date().toLocaleDateString("ar-MR")} · {students.length} تلميذ
            </p>
          </Card>

          <Card padding="sm">
            <div className="divide-y">
              {students.map((s, i) => {
                const status = getStatus(s.id)
                const { icon: Icon, variant, label } = STATUS_CONFIG[status]
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors"
                    onClick={() => toggle(s.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 w-6">{i + 1}</span>
                      <span className="font-medium">{s.firstName} {s.lastName}</span>
                    </div>
                    <Badge variant={variant}>
                      <Icon className="h-3 w-3" /> {label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </Card>

          <Button
            fullWidth
            size="lg"
            loading={saving}
            onClick={save}
            className="mt-6"
          >
            <Save className="h-5 w-5" />
            حفظ الغياب وإرسال الإشعارات
          </Button>
        </>
      )}
    </div>
  )
}