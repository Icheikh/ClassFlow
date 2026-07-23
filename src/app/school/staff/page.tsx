"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, LoadingPage, ConfirmModal, Pagination } from "@/components/ui"
import { StaffList } from "@/components/staff/StaffList"
import { StaffFormModal } from "@/components/staff/StaffFormModal"
import { Plus, Search } from "lucide-react"
import toast from "react-hot-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { getLocaleDirection } from "@/i18n/config"

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
  const router = useRouter()
  const user = useCurrentUser()
  const locale = useLocale()
  const dir = getLocaleDirection(locale)
  const t = useTranslations("staffPage")
  const tPermissions = useTranslations("permissionLabels")
  const tCategories = useTranslations("permissionCategories")
  const tPresets = useTranslations("permissionPresets")
  const tCommon = useTranslations("common")
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const limit = 10

  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)

  const [permModal, setPermModal] = useState(false)
  const [permTarget, setPermTarget] = useState<StaffMember | null>(null)
  const [permSelection, setPermSelection] = useState<string[]>([])
  const [permSaving, setPermSaving] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<{ id: string; current: boolean } | null>(null)

  const fetchStaff = useCallback(async () => {
    const { data, error } = await api.get<StaffMember[]>("/api/school/staff")
    if (data) setStaff(data)
    if (error) toast.error(error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user.role) return
    if (user.role !== "SCHOOL_ADMIN") {
      router.replace("/school")
      return
    }

    fetchStaff()
  }, [fetchStaff, router, user.role])
  useEffect(() => { setPage(1) }, [search])

  async function handleCreate(data: { name: string; email: string; phone: string; password: string; permissions: string[] }) {
    const { error } = await api.post("/api/school/staff", data)
    if (error) { toast.error(error); return }
    toast.success(t("createSuccess"))
    setAddModal(false)
    fetchStaff()
  }

  async function handleEdit(data: { name: string; email: string; phone: string; password: string; permissions: string[] }) {
    if (!editTarget) return
    const { error } = await api.put("/api/school/staff", { id: editTarget.id, name: data.name, phone: data.phone })
    if (error) { toast.error(error); return }
    toast.success(t("editSuccess"))
    setEditModal(false)
    setEditTarget(null)
    fetchStaff()
  }

  async function handleToggleActive(id: string, current: boolean) {
    const { error } = await api.put("/api/school/staff", { id, isActive: !current })
    setToggleTarget(null)
    if (error) { toast.error(error); return }
    toast.success(current ? t("disableSuccess") : t("enableSuccess"))
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
    toast.success(t("permissionsUpdated"))
    setPermModal(false)
    setPermTarget(null)
    setPermSaving(false)
    fetchStaff()
  }

  const filtered = staff.filter(
    (s) => s.name.includes(search) || s.email.includes(search)
  )
  const paginatedStaff = filtered.slice((page - 1) * limit, page * limit)

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / limit))
    if (page > maxPage) setPage(maxPage)
  }, [filtered.length, limit, page])

  if (user.role && user.role !== "SCHOOL_ADMIN") return <LoadingPage />
  if (loading) return <LoadingPage />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setAddModal(true)}>
          <Plus className="h-5 w-5" /> {t("addStaff")}
        </Button>
      </div>

      <Card padding="md" className="mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            dir={dir}
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </Card>

      <StaffList
        items={paginatedStaff}
        onEdit={openEdit}
        onManagePermissions={openPermModal}
         onToggleActive={(id, current) => setToggleTarget({ id, current })}
      />
      <Pagination page={page} total={filtered.length} limit={limit} onChange={setPage} />

      <StaffFormModal
        open={addModal}
        onClose={() => setAddModal(false)}
        onSave={handleCreate}
        title={t("addModalTitle")}
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
          title={t("editModalTitle")}
        />
      )}

      {/* Permissions modal */}
      {permTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPermModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t("permissionsTitle", { name: permTarget.name })}</h2>
              <button onClick={() => setPermModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {/* Presets */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "academicManager", perms: ["MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS", "REVIEW_LESSONS", "APPROVE_GRADES"] },
                  { label: "accountant", perms: ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"] },
                  { label: "assistantDirector", perms: ["MANAGE_STUDENTS", "MANAGE_TEACHERS", "VIEW_REPORTS"] },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setPermSelection(preset.perms)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                  >
                    {tPresets(preset.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries({
                USERS: { codes: ["MANAGE_USERS"] },
                STUDENTS: { codes: ["MANAGE_STUDENTS"] },
                TEACHERS: { codes: ["MANAGE_TEACHERS", "MANAGE_SUBJECTS", "MANAGE_COEFFICIENTS"] },
                ACADEMIC: { codes: ["MANAGE_ACADEMIC_YEARS", "MANAGE_CLASSROOMS"] },
                GRADES: { codes: ["REVIEW_LESSONS", "APPROVE_GRADES", "LOCK_GRADES"] },
                FINANCE: { codes: ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"] },
                REPORTS: { codes: ["VIEW_REPORTS"] },
                NOTIFICATIONS: { codes: ["SEND_NOTIFICATIONS"] },
              } as Record<string, { codes: string[] }>).map(([key, cat]) => (
                <div key={key}>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">{tCategories.has(key) ? tCategories(key) : key}</h4>
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
                        {tPermissions.has(code) ? tPermissions(code) : code}
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
                {permSaving ? t("savingPermissions") : t("savePermissions")}
              </button>
              <button
                onClick={() => { setPermModal(false); setPermTarget(null) }}
                className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                {tCommon("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => void handleToggleActive(toggleTarget!.id, toggleTarget!.current)}
        title={toggleTarget?.current ? t("disableTitle") : t("enableTitle")}
        message={toggleTarget?.current ? t("disableMessage") : t("enableMessage")}
        confirmText={toggleTarget?.current ? t("disableConfirm") : t("enableConfirm")}
        cancelText={tCommon("cancel")}
        variant={toggleTarget?.current ? "danger" : "primary"}
      />
    </div>
  )
}
