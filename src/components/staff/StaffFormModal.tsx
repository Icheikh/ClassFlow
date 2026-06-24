"use client"

import { useState } from "react"
import { Modal, Input, Button } from "@/components/ui"
import { PermissionGrid } from "./PermissionGrid"
import { PermissionPresets } from "./PermissionPresets"

interface StaffFormData {
  name: string
  email: string
  phone: string
  password: string
}

interface StaffFormModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: StaffFormData & { permissions: string[] }) => Promise<void>
  initial?: StaffFormData & { id?: string; permissions?: string[] }
  title: string
}

export function StaffFormModal({ open, onClose, onSave, initial, title }: StaffFormModalProps) {
  const [form, setForm] = useState<StaffFormData>(
    initial || { name: "", email: "", phone: "", password: "password123" }
  )
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions || [])
  const [saving, setSaving] = useState(false)

  function reset() {
    setForm(initial || { name: "", email: "", phone: "", password: "password123" })
    setPermissions(initial?.permissions || [])
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ ...form, permissions })
      reset()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <Input
          label="الاسم الكامل"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="أحمد محمد"
        />
        <Input
          label="البريد الإلكتروني"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="staff@school.edu"
        />
        <Input
          label="الهاتف"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+222 12 34 56 78"
        />
        {!initial?.id && (
          <Input
            label="كلمة المرور"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        )}

        <div className="border-t pt-4">
          <PermissionPresets onSelect={setPermissions} />
        </div>

        <div className="border-t pt-4">
          <PermissionGrid selected={permissions} onChange={setPermissions} />
        </div>

        <Button fullWidth onClick={handleSave} disabled={saving}>
          {saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </div>
    </Modal>
  )
}
