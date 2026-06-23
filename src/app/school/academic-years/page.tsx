"use client"

import { useEffect, useState } from "react"
import { academicYearsApi, termsApi } from "@/lib/api/school"
import { Button, Card, Modal, Input, Select, Badge } from "@/components/ui"
import { Plus, Save, Calendar } from "lucide-react"
import toast from "react-hot-toast"

type AcademicYear = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  isActive: boolean
  terms: Term[]
}

type Term = {
  id: string
  name: string
  order: number
  startsAt: string
  endsAt: string
  isActive: boolean
}

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showTermModal, setShowTermModal] = useState(false)
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null)
  const [editYear, setEditYear] = useState<AcademicYear | null>(null)

  // Year form
  const [yearName, setYearName] = useState("")
  const [yearStart, setYearStart] = useState("")
  const [yearEnd, setYearEnd] = useState("")

  // Term form
  const [termName, setTermName] = useState("")
  const [termOrder, setTermOrder] = useState("1")
  const [termStart, setTermStart] = useState("")
  const [termEnd, setTermEnd] = useState("")

  const fetchYears = async () => {
    const { data } = await academicYearsApi.list()
    if (data) setYears(data)
    setLoading(false)
  }

  useEffect(() => { fetchYears() }, [])

  async function saveYear() {
    if (!yearName || !yearStart || !yearEnd) { toast.error("يرجى ملء جميع الحقول"); return }

    const result = editYear
      ? await academicYearsApi.update({ id: editYear.id, name: yearName, startsAt: yearStart, endsAt: yearEnd })
      : await academicYearsApi.create({ name: yearName, startsAt: yearStart, endsAt: yearEnd })

    if (result.error) toast.error(result.error)
    else {
      toast.success(editYear ? "تم تعديل السنة" : "تم إنشاء السنة")
      setShowModal(false)
      setEditYear(null)
      resetYearForm()
      fetchYears()
    }
  }

  async function activateYear(year: AcademicYear) {
    const { error } = await academicYearsApi.update({
      id: year.id, name: year.name, startsAt: year.startsAt, endsAt: year.endsAt, isActive: true,
    })
    if (error) toast.error(error)
    else { toast.success("تم تفعيل السنة"); fetchYears() }
  }

  async function saveTerm() {
    if (!termName || !termStart || !termEnd || !selectedYear) { toast.error("يرجى ملء جميع الحقول"); return }
    const { error } = await termsApi.create({
      academicYearId: selectedYear.id, name: termName, startsAt: termStart, endsAt: termEnd, order: termOrder,
    })
    if (error) toast.error(error)
    else {
      toast.success("تم إضافة الفصل")
      setShowTermModal(false)
      resetTermForm()
      fetchYears()
    }
  }

  function openAddYear() { setEditYear(null); resetYearForm(); setShowModal(true) }
  function openEditYear(year: AcademicYear) { setEditYear(year); setYearName(year.name); setYearStart(year.startsAt.split("T")[0]); setYearEnd(year.endsAt.split("T")[0]); setShowModal(true) }
  function resetYearForm() { setYearName(""); setYearStart(""); setYearEnd("") }
  function resetTermForm() { setTermName(""); setTermOrder("1"); setTermStart(""); setTermEnd("") }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">السنوات الدراسية والفصول</h1>
          <p className="text-sm text-gray-500">إدارة السنوات الدراسية والفصول الثلاثة لكل سنة</p>
        </div>
        <Button onClick={openAddYear}>
          <Plus className="h-5 w-5" /> سنة جديدة
        </Button>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editYear ? "تعديل سنة" : "إضافة سنة"}>
        <div className="space-y-4">
          <Input label="اسم السنة" value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder="مثال: 2026/2027" />
          <Input label="تاريخ البداية" type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
          <Input label="تاريخ النهاية" type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button fullWidth onClick={saveYear}>حفظ</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showTermModal} onClose={() => setShowTermModal(false)} title={`إضافة فصل لـ ${selectedYear?.name}`}>
        <div className="space-y-4">
          <Input label="اسم الفصل" value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="مثال: الفصل الأول" />
          <Input label="الترتيب" type="number" value={termOrder} onChange={(e) => setTermOrder(e.target.value)} min="1" max="3" />
          <Input label="تاريخ البداية" type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} />
          <Input label="تاريخ النهاية" type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowTermModal(false)}>إلغاء</Button>
            <Button fullWidth onClick={saveTerm}>حفظ</Button>
          </div>
        </div>
      </Modal>

      {loading ? (
        <Card><p className="text-center text-gray-400 py-8">جاري التحميل...</p></Card>
      ) : years.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد سنوات دراسية بعد</p>
            <p className="text-sm text-gray-400 mt-1">أضف السنة الدراسية الأولى</p>
            <Button className="mt-4" onClick={openAddYear}>
              <Plus className="h-5 w-5" /> إضافة سنة
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {years.map((year) => (
            <Card key={year.id} padding="lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold">{year.name}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(year.startsAt).toLocaleDateString("ar-MR")} → {new Date(year.endsAt).toLocaleDateString("ar-MR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {year.isActive ? (
                    <Badge variant="success">نشطة</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => activateYear(year)}>تفعيل</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEditYear(year)}>تعديل</Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">الفصول الدراسية</span>
                  <Button variant="secondary" size="sm" onClick={() => { setSelectedYear(year); setShowTermModal(true) }}>
                    <Plus className="h-4 w-4" /> إضافة فصل
                  </Button>
                </div>

                {year.terms.length === 0 ? (
                  <p className="text-sm text-gray-400">لا توجد فصول بعد</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {year.terms.sort((a, b) => a.order - b.order).map((term) => (
                      <div key={term.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{term.name}</span>
                          <Badge variant={term.isActive ? "success" : "default"}>
                            {term.isActive ? "نشط" : "غير نشط"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(term.startsAt).toLocaleDateString("ar-MR")} → {new Date(term.endsAt).toLocaleDateString("ar-MR")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}