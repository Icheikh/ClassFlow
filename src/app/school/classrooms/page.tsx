"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Button, Card, Modal, Input, Select, Badge } from "@/components/ui"
import { Plus, DoorOpen, Edit2, Trash2, Eye } from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

type Classroom = { id: string; name: string; capacity: number; level: { id: string; name: string; stage: { name: string } }; stream: { id: string; name: string } | null }
type Level = { id: string; name: string; stage: { name: string } }

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Classroom | null>(null)
  const [name, setName] = useState("")
  const [levelId, setLevelId] = useState("")
  const [capacity, setCapacity] = useState("40")

  const fetchData = async () => {
    const [c, l] = await Promise.all([
      api.get<Classroom[]>("/api/school/classrooms"),
      api.get<Level[]>("/api/school/levels"),
    ])
    if (c.data) setClassrooms(c.data)
    if (l.data) setLevels(l.data)
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [])

  function openAdd() {
    setEditing(null); setName(""); setLevelId(""); setCapacity("40"); setShowModal(true)
  }

  function openEdit(c: Classroom) {
    setEditing(c); setName(c.name); setLevelId(c.level.id); setCapacity(String(c.capacity)); setShowModal(true)
  }

  async function save() {
    if (!name || !levelId) { toast.error("يرجى ملء الحقول"); return }
    const { error } = editing
      ? await api.put("/api/school/classrooms", { id: editing.id, name, levelId, capacity })
      : await api.post("/api/school/classrooms", { name, levelId, capacity })
    if (error) toast.error(error)
    else { toast.success(editing ? "تم التعديل" : "تمت الإضافة"); setShowModal(false); fetchData() }
  }

  async function deleteItem(id: string) {
    if (!confirm("هل أنت متأكد؟")) return
    const { error } = await api.delete(`/api/school/classrooms?id=${id}`)
    if (error) toast.error(error); else { toast.success("تم الحذف"); fetchData() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الأقسام</h1>
          <p className="text-sm text-gray-500">إدارة الفصول الدراسية والقاعات</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-5 w-5" /> إضافة قسم</Button>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "تعديل قسم" : "إضافة قسم"}>
        <div className="space-y-4">
          <Input label="اسم القسم" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: 1A" />
          <Select
            label="المستوى"
            value={levelId}
            onChange={setLevelId}
            options={levels.map((l) => ({ value: l.id, label: `${l.stage.name} - ${l.name}` }))}
            placeholder="اختر المستوى"
          />
          <Input label="السعة القصوى" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <Button fullWidth onClick={save}>حفظ</Button>
        </div>
      </Modal>

      {loading ? (
        <Card><p className="text-center text-gray-400 py-8">جاري التحميل...</p></Card>
      ) : classrooms.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <DoorOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد أقسام بعد</p>
            <Button className="mt-4" onClick={openAdd}><Plus className="h-5 w-5" /> إضافة قسم</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map((c) => (
            <Card key={c.id} className="relative group">
              <Link href={`/school/classrooms/${c.id}`} className="block">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-blue-700 group-hover:underline">{c.name}</h3>
                    <p className="text-sm text-gray-500">{c.level.stage.name} - {c.level.name}</p>
                    {c.stream && <Badge variant="info">{c.stream.name}</Badge>}
                    <p className="text-xs text-gray-400 mt-1">السعة: {c.capacity} طالب</p>
                  </div>
                  <Eye className="h-5 w-5 text-gray-300 group-hover:text-blue-500" />
                </div>
              </Link>
              <div className="absolute left-3 bottom-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.preventDefault(); openEdit(c) }} className="p-1.5 hover:bg-gray-100 rounded"><Edit2 className="h-4 w-4" /></button>
                <button onClick={(e) => { e.preventDefault(); deleteItem(c.id) }} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}