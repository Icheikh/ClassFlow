"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { api } from "@/lib/api"
import { Button, Card, Input, Select, Modal, Badge, LoadingPage, ConfirmModal } from "@/components/ui"
import { Plus, Pencil, Trash2, Link2, Wallet } from "lucide-react"
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
  const t = useTranslations("feesPage")
  const tCommon = useTranslations("common")
  const [fees, setFees] = useState<Fee[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)

  const [editModal, setEditModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", amount: "", frequency: "MONTHLY", levelId: "", classroomId: "" })
  const [saving, setSaving] = useState(false)

  const [assignModal, setAssignModal] = useState(false)
  const [assignFeeId, setAssignFeeId] = useState<string | null>(null)
  const [assignClassroomId, setAssignClassroomId] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [feeToDelete, setFeeToDelete] = useState<string | null>(null)

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

  useEffect(() => {
    void load()
  }, [])

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
    if (!form.name || !form.amount) {
      toast.error(t("nameAmountRequired"))
      return
    }

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

    if (error) {
      toast.error(error)
    } else {
      toast.success(editId ? t("updated") : t("created"))
      setEditModal(false)
      await load()
    }

    setSaving(false)
  }

  async function remove(id: string) {
    const { error } = await api.delete(`/api/school/fees/${id}`)
    setFeeToDelete(null)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("deleted"))
      await load()
    }
  }

  function openAssign(feeId: string) {
    setAssignFeeId(feeId)
    setAssignClassroomId("")
    setAssignModal(true)
  }

  async function doAssign() {
    if (!assignFeeId || !assignClassroomId) {
      toast.error(t("selectClassroom"))
      return
    }

    setAssigning(true)
    const { data, error } = await api.post<{ created: number }>("/api/school/student-fees/bulk", {
      feeId: assignFeeId,
      classroomId: assignClassroomId,
    })

    if (error) {
      toast.error(error)
    } else {
      toast.success(t("assignedToStudents", { count: data?.created || 0 }))
      setAssignModal(false)
      await load()
    }

    setAssigning(false)
  }

  const stats = useMemo(() => {
    const activeFees = fees.filter((fee) => fee.isActive)
    const monthlyFees = fees.filter((fee) => fee.frequency === "MONTHLY").length
    const yearlyFees = fees.filter((fee) => fee.frequency === "YEARLY").length
    const assignedStudents = fees.reduce((sum, fee) => sum + (fee._count?.studentFees || 0), 0)

    return {
      total: fees.length,
      active: activeFees.length,
      monthly: monthlyFees,
      yearly: yearlyFees,
      assignedStudents,
    }
  }, [fees])

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-5 w-5" /> {t("addFee")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("totalFees")}</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("activeFees")}</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("monthlyFees")}</p>
          <p className="text-2xl font-bold text-blue-700">{stats.monthly}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("yearlyFees")}</p>
          <p className="text-2xl font-bold text-amber-600">{stats.yearly}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-400">{t("totalAssignments")}</p>
          <p className="text-2xl font-bold text-gray-900">{stats.assignedStudents}</p>
        </Card>
      </div>

      <Card padding="lg" className="border-blue-100 bg-blue-50">
        <h2 className="text-lg font-semibold text-gray-900">{t("howItWorks")}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 text-sm">
            <p className="font-medium text-gray-900">{t("step1Title")}</p>
            <p className="mt-2 text-gray-600">{t("step1Text")}</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-sm">
            <p className="font-medium text-gray-900">{t("step2Title")}</p>
            <p className="mt-2 text-gray-600">{t("step2Text")}</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-sm">
            <p className="font-medium text-gray-900">{t("step3Title")}</p>
            <p className="mt-2 text-gray-600">{t("step3Text")}</p>
          </div>
        </div>
      </Card>

      {fees.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <Wallet className="mx-auto mb-4 h-16 w-16 text-gray-200" />
            <p className="mb-1 text-lg text-gray-500">{t("emptyTitle")}</p>
            <p className="mb-4 text-sm text-gray-400">{t("emptyText")}</p>
            <Button onClick={openAdd}>
              <Plus className="h-5 w-5" /> {t("addFee")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {fees.map((fee) => {
            const levelLabel = levels.find((level) => level.id === fee.levelId)?.name || t("allLevels")
            const classroomLabel = classrooms.find((classroom) => classroom.id === fee.classroomId)?.name || t("allClassrooms")
            const frequencyLabel = fee.frequency === "MONTHLY" ? t("frequencyMonthly") : fee.frequency === "YEARLY" ? t("frequencyYearly") : fee.frequency === "ONE_TIME" ? t("frequencyOneTime") : fee.frequency

            return (
              <Card key={fee.id} padding="lg">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{fee.name}</h3>
                      <Badge variant={fee.isActive ? "success" : "danger"}>
                        {fee.isActive ? t("active") : t("inactive")}
                      </Badge>
                      <Badge>{frequencyLabel}</Badge>
                    </div>

                    <p className="text-2xl font-bold text-blue-600">{fee.amount} MRU</p>

                    <div className="grid gap-3 text-sm md:grid-cols-3">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">{t("targetLevel")}</p>
                        <p className="mt-1 font-medium text-gray-900">{levelLabel}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">{t("targetClassroom")}</p>
                        <p className="mt-1 font-medium text-gray-900">{classroomLabel}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">{t("assignedStudentsCount")}</p>
                        <p className="mt-1 font-medium text-gray-900">{fee._count?.studentFees ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openAssign(fee.id)}>
                      <Link2 className="h-4 w-4" /> {t("assignToClassroom")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(fee)} aria-label={t("editAria")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setFeeToDelete(fee.id)} aria-label={t("deleteAria")}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={editModal} onClose={() => setEditModal(false)} title={editId ? t("editFee") : t("newFee")}>
        <div className="space-y-4">
          <Input label={t("feeName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t("amountMru")} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Select
            label={t("frequency")}
            value={form.frequency}
            onChange={(value) => setForm({ ...form, frequency: value })}
            options={[
              { value: "MONTHLY", label: t("frequencyMonthly") },
              { value: "YEARLY", label: t("frequencyYearly") },
              { value: "ONE_TIME", label: t("frequencyOneTime") },
            ]}
          />
          <Select
            label={t("levelOptional")}
            value={form.levelId}
            onChange={(value) => setForm({ ...form, levelId: value })}
            options={[{ value: "", label: t("allLevels") }, ...levels.map((level) => ({ value: level.id, label: level.name }))]}
          />
          <Select
            label={t("classroomOptional")}
            value={form.classroomId}
            onChange={(value) => setForm({ ...form, classroomId: value })}
            options={[{ value: "", label: t("allClassrooms") }, ...classrooms.map((classroom) => ({ value: classroom.id, label: classroom.name }))]}
          />
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {t("definitionHint")}
          </div>
          <Button fullWidth loading={saving} onClick={save}>
            {editId ? t("saveEdit") : t("createFee")}
          </Button>
        </div>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title={t("assignFeeToClassroom")}>
        <div className="space-y-4">
          <Select
            label={t("chooseClassroom")}
            value={assignClassroomId}
            onChange={setAssignClassroomId}
            options={classrooms.map((classroom) => ({ value: classroom.id, label: classroom.name }))}
          />
          <p className="text-sm text-gray-500">
            {t("assignHint")}
          </p>
          <Button fullWidth loading={assigning} onClick={doAssign}>{t("confirmAssignment")}</Button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!feeToDelete}
        onClose={() => setFeeToDelete(null)}
        onConfirm={() => void remove(feeToDelete!)}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        variant="danger"
      />
    </div>
  )
}
