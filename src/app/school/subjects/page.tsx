"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Select, Badge } from "@/components/ui"
import { Plus, BookOpen, Edit2, Trash2, Hash, Layers } from "lucide-react"
import toast from "react-hot-toast"

type Subject = { id: string; nameAr: string; nameFr: string | null; code: string | null }
type Level = { id: string; name: string; stage: { name: string } }
type Stream = { id: string; name: string; levelId: string }
type Coefficient = { id: string; subjectId: string; levelId: string; streamId: string | null; coefficient: number; subject: Subject; level: Level; stream: { name: string } | null }

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [coefficients, setCoefficients] = useState<Coefficient[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)

  const [showSubjModal, setShowSubjModal] = useState(false)
  const [showCoefModal, setShowCoefModal] = useState(false)
  const [editingSubj, setEditingSubj] = useState<Subject | null>(null)
  const [subjName, setSubjName] = useState("")
  const [subjCode, setSubjCode] = useState("")
  const [subjNameFr, setSubjNameFr] = useState("")

  const [coefSubjectId, setCoefSubjectId] = useState("")
  const [coefLevelId, setCoefLevelId] = useState("")
  const [coefStreamId, setCoefStreamId] = useState("")
  const [coefValue, setCoefValue] = useState("1")

  const fetchData = async () => {
    const [s, c, l, st] = await Promise.all([
      api.get<Subject[]>("/api/school/subjects"),
      api.get<Coefficient[]>("/api/school/subject-coefficients"),
      api.get<Level[]>("/api/school/levels"),
      api.get<Stream[]>("/api/school/streams"),
    ])
    if (s.data) setSubjects(s.data)
    if (c.data) setCoefficients(c.data)
    if (l.data) setLevels(l.data)
    if (st.data) setStreams(st.data)
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  const filteredStreams = streams.filter((s) => s.levelId === coefLevelId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">المواد والمعاملات</h1>
          <p className="text-sm text-gray-500">إدارة المواد الدراسية ومعاملاتها حسب المستوى والشعبة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setEditingSubj(null); setSubjName(""); setSubjCode(""); setSubjNameFr(""); setShowSubjModal(true) }}>
            <BookOpen className="h-5 w-5" /> مادة
          </Button>
          <Button onClick={() => { setCoefSubjectId(""); setCoefLevelId(""); setCoefStreamId(""); setCoefValue("1"); setShowCoefModal(true) }}>
            <Hash className="h-5 w-5" /> معامل
          </Button>
        </div>
      </div>

      {/* Modals */}
      <Modal open={showSubjModal} onClose={() => setShowSubjModal(false)} title={editingSubj ? "تعديل مادة" : "إضافة مادة"}>
        <div className="space-y-4">
          <Input label="الاسم (عربي)" value={subjName} onChange={(e) => setSubjName(e.target.value)} placeholder="رياضيات" />
          <Input label="الاسم (فرنسي)" value={subjNameFr} onChange={(e) => setSubjNameFr(e.target.value)} placeholder="Mathématiques" />
          <Input label="الرمز" value={subjCode} onChange={(e) => setSubjCode(e.target.value)} placeholder="MATH" />
          <Button fullWidth onClick={async () => {
            if (!subjName) { toast.error("يرجى إدخال اسم المادة"); return }
            const { error } = editingSubj
              ? await api.put("/api/school/subjects", { id: editingSubj.id, nameAr: subjName, nameFr: subjNameFr, code: subjCode })
              : await api.post("/api/school/subjects", { nameAr: subjName, nameFr: subjNameFr, code: subjCode })
            if (error) toast.error(error)
            else { toast.success(editingSubj ? "تم التعديل" : "تمت الإضافة"); setShowSubjModal(false); fetchData() }
          }}>حفظ</Button>
        </div>
      </Modal>

      <Modal open={showCoefModal} onClose={() => setShowCoefModal(false)} title="إضافة معامل">
        <div className="space-y-4">
          <Select label="المادة" value={coefSubjectId} onChange={setCoefSubjectId}
            options={subjects.map((s) => ({ value: s.id, label: s.nameAr }))} placeholder="اختر المادة" />
          <Select label="المستوى" value={coefLevelId} onChange={(v) => { setCoefLevelId(v); setCoefStreamId("") }}
            options={levels.map((l) => ({ value: l.id, label: `${l.stage.name} - ${l.name}` }))} placeholder="اختر المستوى" />
          {filteredStreams.length > 0 && (
            <Select label="الشعبة" value={coefStreamId} onChange={setCoefStreamId}
              options={[{ value: "", label: "بدون شعبة" }, ...filteredStreams.map((s) => ({ value: s.id, label: s.name }))]}
              placeholder="اختر الشعبة" />
          )}
          <Input label="المعامل" type="number" step="0.5" value={coefValue} onChange={(e) => setCoefValue(e.target.value)} placeholder="1" />
          <Button fullWidth onClick={async () => {
            if (!coefSubjectId || !coefLevelId) { toast.error("يرجى ملء الحقول"); return }
            const { error } = await api.post("/api/school/subject-coefficients", {
              subjectId: coefSubjectId, levelId: coefLevelId, streamId: coefStreamId || undefined, coefficient: coefValue,
            })
            if (error) toast.error(error)
            else { toast.success("تمت إضافة المعامل"); setShowCoefModal(false); fetchData() }
          }}>حفظ</Button>
        </div>
      </Modal>

      {loading ? (
        <Card><p className="text-center text-gray-400 py-8">جاري التحميل...</p></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subjects list */}
          <Card padding="lg" className="lg:col-span-1">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><BookOpen className="h-5 w-5" /> المواد</h3>
            {subjects.length === 0 ? (
              <p className="text-gray-400 text-sm">لا توجد مواد بعد</p>
            ) : (
              <div className="space-y-2">
                {subjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{s.nameAr}</span>
                      {s.code && <span className="text-xs text-gray-400 mr-2">{s.code}</span>}
                    </div>
                    <button onClick={() => { setEditingSubj(s); setSubjName(s.nameAr); setSubjNameFr(s.nameFr || ""); setSubjCode(s.code || ""); setShowSubjModal(true) }}>
                      <Edit2 className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Coefficients table */}
          <Card padding="lg" className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Hash className="h-5 w-5" /> المعاملات</h3>
              <Badge variant="info">{coefficients.length} معامل</Badge>
            </div>
            {coefficients.length === 0 ? (
              <p className="text-gray-400 text-sm">لا توجد معاملات بعد. أضف معاملاً لكل مادة في كل مستوى.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-right py-2 px-3">المادة</th>
                      <th className="text-right py-2 px-3">المستوى</th>
                      <th className="text-right py-2 px-3">الشعبة</th>
                      <th className="text-center py-2 px-3">المعامل</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {coefficients.map((c) => (
                      <tr key={c.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{c.subject.nameAr}</td>
                        <td className="py-2 px-3 text-gray-600">{c.level.stage.name} - {c.level.name}</td>
                        <td className="py-2 px-3">{c.stream?.name || <span className="text-gray-300">—</span>}</td>
                        <td className="py-2 px-3 text-center">{c.coefficient}</td>
                        <td className="py-2 px-3 text-left">
                          <button onClick={async () => {
                            if (!confirm("هل أنت متأكد؟")) return
                            await api.delete(`/api/school/subject-coefficients?id=${c.id}`)
                            fetchData()
                          }} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
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