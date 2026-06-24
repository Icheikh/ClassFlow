"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Button, Input, Card, LoadingPage } from "@/components/ui"
import { StaffList } from "@/components/staff/StaffList"
import { StaffFormModal } from "@/components/staff/StaffFormModal"
import { Plus, Search } from "lucide-react"
import toast from "react-hot-toast"

interface StaffMember {
  id: string
  email: string
  name: string
  phone: string | null
  isActive: boolean
  permissions: string[]
  createdAt: string
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)

  const [permModal, setPermModal] = useState(false)
  const [permTarget, setPermTarget] = useState<StaffMember | null>(null)
  const [permSelection, setPermSelection] = useState<string[]>([])
  const [permSaving, setPermSaving] = useState(false)

  const fetchStaff = useCallback(async () => {
    const { data, error } = await api.get<StaffMember[]>("/api/school/staff")
    if (data) setStaff(data)
    if (error) toast.error(error)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  async function handleCreate(data: { name: string; email: string; phone: string; password: string; permissions: string[] }) {
    const { error } = await api.post("/api/school/staff", data)
    if (error) { toast.error(error); return }
    toast.success("تمت إضافة الموظف")
    setAddModal(false)
    fetchStaff()
  }

  async function handleEdit(data: { name: string; email: string; phone: string; password: string; permissions: string[] }) {
    if (!editTarget) return
    const { error } = await api.put("/api/school/staff", { id: editTarget.id, name: data.name, phone: data.phone })
    if (error) { toast.error(error); return }
    toast.success("تم التعديل")
    setEditModal(false)
    setEditTarget(null)
    fetchStaff()
  }

  async function handleToggleActive(id: string, current: boolean) {
    const action = current ? "تعطيل" : "تفعيل"
    if (!confirm(`سيتم ${action} حساب هذا الموظف. هل أنت متأكد؟`)) return
    const { error } = await api.put("/api/school/staff", { id, isActive: !current })
    if (error) { toast.error(error); return }
    toast.success(current ? "تم التعطيل" : "تم التفعيل")
    fetchStaff()
  }

  function openEdit(member: StaffMember) {
    setEditTarget(member)
    setEditModal(true)
  }

  function openPermModal(member: StaffMember) {
    setPermTarget(member)
    setPermSelection([...member.permissions])
    setPermModal(true)
  }

  async function savePermissions() {
    if (!permTarget) return
    setPermSaving(true)
    const { error } = await api.put(`/api/school/staff/${permTarget.id}/permissions`, {
      permissions: permSelection,
    })
    if (error) { toast.error(error); return }
    toast.success("تم تحديث الصلاحيات")
    setPermModal(false)
    setPermTarget(null)
    setPermSaving(false)
    fetchStaff()
  }

  const filtered = staff.filter(
    (s) => s.name.includes(search) || s.email.includes(search)
  )

  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الموظفون والصلاحيات</h1>
          <p className="text-sm text-gray-500">إدارة حسابات الموظفين وتحديد صلاحياتهم</p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <Plus className="h-5 w-5" /> إضافة موظف
        </Button>
      </div>

      <Card padding="md" className="mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            placeholder="ابحث بالاسم أو البريد الإلكتروني..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
          />
        </div>
      </Card>

      <StaffList
        items={filtered}
        onEdit={openEdit}
        onManagePermissions={openPermModal}
        onToggleActive={handleToggleActive}
      />

      <StaffFormModal
        open={addModal}
        onClose={() => setAddModal(false)}
        onSave={handleCreate}
        title="إضافة موظف جديد"
      />

      {editTarget && (
        <StaffFormModal
          open={editModal}
          onClose={() => { setEditModal(false); setEditTarget(null) }}
          onSave={handleEdit}
          initial={{
            id: editTarget.id,
            name: editTarget.name,
            email: editTarget.email,
            phone: editTarget.phone || "",
            password: "",
            permissions: editTarget.permissions,
          }}
          title="تعديل بيانات الموظف"
        />
      )}

      {/* Permissions modal */}
      {permTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPermModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">صلاحيات {permTarget.name}</h2>
              <button onClick={() => setPermModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {/* Presets */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "مدير الدراسات", perms: ["MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS", "REVIEW_LESSONS", "APPROVE_GRADES"] },
                  { label: "محاسب", perms: ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"] },
                  { label: "مساعد مدير", perms: ["MANAGE_STUDENTS", "MANAGE_TEACHERS", "VIEW_REPORTS"] },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setPermSelection(preset.perms)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries({
                USERS: { label: "إدارة المستخدمين", codes: ["MANAGE_USERS"] },
                STUDENTS: { label: "الطلاب", codes: ["MANAGE_STUDENTS"] },
                TEACHERS: { label: "الأساتذة والمواد", codes: ["MANAGE_TEACHERS", "MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS"] },
                ACADEMIC: { label: "السنوات والأقسام", codes: ["MANAGE_ACADEMIC_YEARS", "MANAGE_CLASSROOMS"] },
                GRADES: { label: "الدرجات والدروس", codes: ["REVIEW_LESSONS", "APPROVE_GRADES", "LOCK_GRADES"] },
                FINANCE: { label: "المالية", codes: ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"] },
                REPORTS: { label: "التقارير", codes: ["VIEW_REPORTS"] },
                NOTIFICATIONS: { label: "الإشعارات", codes: ["SEND_NOTIFICATIONS"] },
              } as Record<string, { label: string; codes: string[] }>).map(([key, cat]) => (
                <div key={key}>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{cat.label}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.codes.map((code) => (
                      <label key={code} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={permSelection.includes(code)}
                          onChange={() => {
                            setPermSelection((prev) =>
                              prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
                            )
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        {code}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={savePermissions}
                disabled={permSaving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {permSaving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
              </button>
              <button
                onClick={() => { setPermModal(false); setPermTarget(null) }}
                className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
