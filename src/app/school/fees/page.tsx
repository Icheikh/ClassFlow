"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Input, Select, Modal, Badge, LoadingPage } from "@/components/ui"
import { Plus, Pencil, Trash2, Link2, Minus, Wallet } from "lucide-react"
import toast from "react-hot-toast"

type Fee = {
  id: string
  name: string
  amount: number
  frequency: string
  levelId: string | null
  classroomId: string | null
  isActive: boolean
  _count?: { studentFees: number }
}

type Classroom = { id: string; name: string }
type Level = { id: string; name: string }

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)

  // Add/Edit modal
  const [editModal, setEditModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", amount: "", frequency: "MONTHLY", levelId: "", classroomId: "" })
  const [saving, setSaving] = useState(false)

  // Assign modal
  const [assignModal, setAssignModal] = useState(false)
  const [assignFeeId, setAssignFeeId] = useState<string | null>(null)
  const [assignClassroomId, setAssignClassroomId] = useState("")
  const [assigning, setAssigning] = useState(false)

  async function load() {
    const [feesRes, classroomsRes, levelsRes] = await Promise.all([
      api.get<Fee[]>("/api/school/fees"),
      api.get<Classroom[]>("/api/school/classrooms"),
      api.get<Level[]>("/api/school/levels"),
    ])
    setFees(feesRes.data || [])
    setClassrooms(classroomsRes.data || [])
    setLevels(levelsRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditId(null)
    setForm({ name: "", amount: "", frequency: "MONTHLY", levelId: "", classroomId: "" })
    setEditModal(true)
  }

  function openEdit(fee: Fee) {
    setEditId(fee.id)
    setForm({
      name: fee.name,
      amount: String(fee.amount),
      frequency: fee.frequency,
      levelId: fee.levelId || "",
      classroomId: fee.classroomId || "",
    })
    setEditModal(true)
  }

  async function save() {
    if (!form.name || !form.amount) { toast.error("الاسم والمبلغ مطلوبان"); return }
    setSaving(true)
    const payload = {
      ...form,
      amount: form.amount,
      levelId: form.levelId || null,
      classroomId: form.classroomId || null,
    }
    const { error } = editId
      ? await api.put(`/api/school/fees/${editId}`, payload)
      : await api.post("/api/school/fees", payload)
    if (error) toast.error(error)
    else {
      toast.success(editId ? "تم التعديل" : "تمت الإضافة")
      setEditModal(false)
      load()
    }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الرسم؟")) return
    const { error } = await api.delete(`/api/school/fees/${id}`)
    if (error) toast.error(error)
    else { toast.success("تم الحذف"); load() }
  }

  function openAssign(feeId: string) {
    setAssignFeeId(feeId)
    setAssignClassroomId("")
    setAssignModal(true)
  }

  async function doAssign() {
    if (!assignFeeId || !assignClassroomId) { toast.error("اختر القسم"); return }
    setAssigning(true)
    const { data, error } = await api.post<{ created: number }>("/api/school/student-fees/bulk", {
      feeId: assignFeeId,
      classroomId: assignClassroomId,
    })
    if (error) toast.error(error)
    else {
      toast.success(`تم تعيين الرسم لـ ${data?.created || 0} طالب`)
      setAssignModal(false)
      load()
    }
    setAssigning(false)
  }

  const freqLabels: Record<string, string> = {
    MONTHLY: "شهري",
    YEARLY: "سنوي",
    ONE_TIME: "لمرة واحدة",
  }

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الرسوم</h1>
        <Button onClick={openAdd}><Plus className="h-5 w-5" /> إضافة رسم</Button>
      </div>

      {fees.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <Wallet className="h-16 w-16 mx-auto text-gray-200 mb-4" />
            <p className="text-gray-500 text-lg mb-1">لا توجد رسوم بعد</p>
            <p className="text-gray-400 text-sm mb-4">أضف أول رسم لتتمكن من تعيينه للأقسام</p>
            <Button onClick={openAdd}><Plus className="h-5 w-5" /> إضافة رسم</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {fees.map((fee) => (
            <Card key={fee.id} padding="md">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{fee.name}</h3>
                    <Badge variant={fee.isActive ? "success" : "danger"}>
                      {fee.isActive ? "نشط" : "موقوف"}
                    </Badge>
                    <Badge>{freqLabels[fee.frequency] || fee.frequency}</Badge>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{fee.amount} MRU</p>
                  <p className="text-sm text-gray-400">
                    {fee._count?.studentFees ?? 0} طالب مسجل • {fee.levelId ? "مستوى محدد" : "جميع المستويات"}
                    {fee.classroomId ? " • قسم محدد" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openAssign(fee.id)}>
                    <Link2 className="h-4 w-4" /> تعيين للأقسام
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(fee)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(fee.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={editId ? "تعديل رسم" : "إضافة رسم"}>
        <div className="space-y-4">
          <Input label="اسم الرسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="المبلغ (MRU)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Select
            label="الدورية"
            value={form.frequency}
            onChange={(v) => setForm({ ...form, frequency: v })}
            options={[
              { value: "MONTHLY", label: "شهري" },
              { value: "YEARLY", label: "سنوي" },
              { value: "ONE_TIME", label: "لمرة واحدة" },
            ]}
          />
          <Select
            label="المستوى (اختياري)"
            value={form.levelId}
            onChange={(v) => setForm({ ...form, levelId: v })}
            options={[{ value: "", label: "جميع المستويات" }, ...levels.map((l) => ({ value: l.id, label: l.name }))]}
          />
          <Select
            label="القسم (اختياري)"
            value={form.classroomId}
            onChange={(v) => setForm({ ...form, classroomId: v })}
            options={[{ value: "", label: "جميع الأقسام" }, ...classrooms.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Button fullWidth loading={saving} onClick={save}>{editId ? "تعديل" : "إضافة"}</Button>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="تعيين الرسم لقسم">
        <div className="space-y-4">
          <Select
            label="اختر القسم"
            value={assignClassroomId}
            onChange={setAssignClassroomId}
            options={classrooms.map((c) => ({ value: c.id, label: c.name }))}
          />
          <p className="text-sm text-gray-400">سيتم تعيين هذا الرسم لجميع الطلاب النشطين في القسم المختار.</p>
          <Button fullWidth loading={assigning} onClick={doAssign}>تعيين</Button>
        </div>
      </Modal>
    </div>
  )
}
