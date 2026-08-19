"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Input, Select, Modal, Badge, LoadingPage, ConfirmModal } from "@/components/ui"
import { Plus, School, Power, Pencil, Trash2, KeyRound } from "lucide-react"
import toast from "react-hot-toast"

type SchoolRow = {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  address: string | null
  subscriptionStatus: string
  billingStudentCount: number
  isActive: boolean
  createdAt: string
  userCount: number
  studentCount: number
  teacherCount: number
  admin: { id?: string; email: string; name: string; isActive: boolean } | null
}

const SUBSCRIPTION_OPTIONS = ["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"]

export default function AdminSchoolsPage() {
  const t = useTranslations("adminPage")
  const tNav = useTranslations("adminNav")
  const tCommon = useTranslations("common")
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [loading, setLoading] = useState(true)

  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    phone: "",
    email: "",
    adminName: "",
    adminEmail: "",
    password: "",
    subscriptionStatus: "TRIAL",
  })
  const [saving, setSaving] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    subscriptionStatus: "TRIAL",
    billingStudentCount: "0",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  })
  const [editModal, setEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deactivateId, setDeactivateId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<SchoolRow | null>(null)
  const [toggleLoading, setToggleLoading] = useState(false)

  async function load() {
    const schoolsRes = await api.get<SchoolRow[]>("/api/admin/schools")
    setSchools(schoolsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setForm({
      name: "",
      slug: "",
      address: "",
      phone: "",
      email: "",
      adminName: "",
      adminEmail: "",
      password: "",
      subscriptionStatus: "TRIAL",
    })
    setCreateModal(true)
  }

  async function createSchool() {
    if (!form.name || !form.adminName || !form.adminEmail) {
      toast.error(t("createRequired"))
      return
    }
    setSaving(true)
    const { error } = await api.post("/api/admin/schools", form)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("createSuccess"))
      setCreateModal(false)
      await load()
    }
    setSaving(false)
  }

  function openEdit(school: SchoolRow) {
    setEditId(school.id)
    setSelectedSchool(school)
    setEditForm({
      name: school.name,
      email: school.email || "",
      phone: school.phone || "",
      address: school.address || "",
      subscriptionStatus: school.subscriptionStatus,
      billingStudentCount: String(school.billingStudentCount),
      adminName: school.admin?.name || "",
      adminEmail: school.admin?.email || "",
      adminPassword: "",
    })
    setEditModal(true)
  }

  async function saveEdit() {
    if (!editId) return
    setSavingEdit(true)
    const { data, error } = await api.put<SchoolRow>(`/api/admin/schools/${editId}`, {
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      address: editForm.address,
      subscriptionStatus: editForm.subscriptionStatus,
      billingStudentCount: Number(editForm.billingStudentCount) || 0,
      admin: {
        userId: selectedSchool?.admin?.id,
        name: editForm.adminName,
        email: editForm.adminEmail,
        password: editForm.adminPassword || undefined,
      },
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("updateSuccess"))
      if (editForm.adminPassword) toast.success(t("adminPasswordUpdated"))
      setEditModal(false)
      await load()
    }
    setSavingEdit(false)
  }

  async function toggleActive(school: SchoolRow) {
    setToggleLoading(true)
    setDeactivateId(null)
    const { error } = await api.put(`/api/admin/schools/${school.id}`, {
      isActive: !school.isActive,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success(school.isActive ? t("deactivated") : t("activated"))
      await load()
    }
    setToggleLoading(false)
  }

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await api.delete(`/api/admin/schools/${deleteId}`)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("deleteSuccess"))
      setDeleteId(null)
      await load()
    }
    setDeleting(false)
  }

  if (loading) return <LoadingPage />

  const statusVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
    TRIAL: "warning",
    ACTIVE: "success",
    EXPIRED: "danger",
    CANCELLED: "default",
  }

  const deletingSchool = schools.find((s) => s.id === deleteId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tNav("schools")}</h1>
          <p className="mt-2 text-sm text-gray-500">{t("description")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-5 w-5" /> {t("addSchool")}
        </Button>
      </div>

      {schools.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <School className="mx-auto mb-4 h-16 w-16 text-gray-200" />
            <p className="mb-1 text-lg text-gray-500">{t("emptyTitle")}</p>
            <p className="mb-4 text-sm text-gray-400">{t("emptyText")}</p>
            <Button onClick={openCreate}>
              <Plus className="h-5 w-5" /> {t("addSchool")}
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right">
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("schoolName")}</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("adminAccount")}</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("studentsCount")}</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("subscription")}</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500">{t("status")}</th>
                  <th className="pb-3 font-medium text-gray-500">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{school.name}</p>
                      <p className="text-xs text-gray-400">{school.slug}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-gray-700">{school.admin?.name || "—"}</p>
                      <p className="text-xs text-gray-400">{school.admin?.email || "—"}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">
                      {school.studentCount} ({school.teacherCount} {t("teachers")})
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant[school.subscriptionStatus] || "default"}>
                        {t(`sub_${school.subscriptionStatus}`)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={school.isActive ? "success" : "danger"}>
                        {school.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(school)} aria-label={t("editAria")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateId(school.id)}
                          aria-label={school.isActive ? t("deactivateAria") : t("activateAria")}
                        >
                          <Power className={`h-4 w-4 ${school.isActive ? "text-red-500" : "text-green-600"}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(school.id)}
                          aria-label={t("deleteAria")}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title={t("newSchool")}>
        <div className="space-y-4">
          <Input label={t("schoolName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t("slugLabel")} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={t("slugPlaceholder")} />
          <div className="grid gap-4 md:grid-cols-2">
            <Input label={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t("email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Input label={t("address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {t("adminSectionHint")}
          </div>
          <Input label={t("adminName")} value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
          <Input label={t("adminEmail")} type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
          <Input
            label={t("adminPassword")}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={t("passwordPlaceholder")}
          />
          <Select
            label={t("subscription")}
            value={form.subscriptionStatus}
            onChange={(value) => setForm({ ...form, subscriptionStatus: value })}
            options={SUBSCRIPTION_OPTIONS.map((status) => ({ value: status, label: t(`sub_${status}`) }))}
          />
          <Button fullWidth loading={saving} onClick={createSchool}>
            {t("createSchool")}
          </Button>
        </div>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title={t("editSchool")}>
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {t("editSchoolHint")}
          </div>
          <Input label={t("schoolName")} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <Input label={t("email")} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            <Input label={t("phone")} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <Input label={t("address")} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label={t("subscription")}
              value={editForm.subscriptionStatus}
              onChange={(value) => setEditForm({ ...editForm, subscriptionStatus: value })}
              options={SUBSCRIPTION_OPTIONS.map((status) => ({ value: status, label: t(`sub_${status}`) }))}
            />
            <Input
              label={t("billingStudentCount")}
              type="number"
              value={editForm.billingStudentCount}
              onChange={(e) => setEditForm({ ...editForm, billingStudentCount: e.target.value })}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <KeyRound className="h-4 w-4" /> {t("adminSectionTitle")}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label={t("adminName")} value={editForm.adminName} onChange={(e) => setEditForm({ ...editForm, adminName: e.target.value })} />
              <Input label={t("adminEmail")} type="email" value={editForm.adminEmail} onChange={(e) => setEditForm({ ...editForm, adminEmail: e.target.value })} />
            </div>
            <div className="mt-3">
              <Input
                label={t("newAdminPassword")}
                value={editForm.adminPassword}
                onChange={(e) => setEditForm({ ...editForm, adminPassword: e.target.value })}
                placeholder={t("newAdminPasswordPlaceholder")}
              />
            </div>
          </div>

          <Button fullWidth loading={savingEdit} onClick={saveEdit}>
            {t("save")}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deactivateId}
        onClose={() => setDeactivateId(null)}
        onConfirm={() => {
          const school = schools.find((s) => s.id === deactivateId)
          if (school) void toggleActive(school)
        }}
        title={t("toggleTitle")}
        message={t("toggleMessage")}
        confirmText={tCommon("confirm")}
        cancelText={tCommon("cancel")}
        variant="danger"
        loading={toggleLoading}
      />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        title={t("deleteTitle")}
        message={
          deletingSchool
            ? t("deleteMessage", { name: deletingSchool.name })
            : ""
        }
        confirmText={t("deleteConfirm")}
        cancelText={tCommon("cancel")}
        variant="danger"
        loading={deleting}
        confirmKeyword={deletingSchool?.name}
        confirmKeywordLabel={t("deleteTypeNameLabel")}
        confirmKeywordPlaceholder={deletingSchool?.name || ""}
      />
    </div>
  )
}