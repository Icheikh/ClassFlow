"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { academicYearsApi, termsApi } from "@/lib/api/school"
import { Button, Card, Modal, Input, Badge } from "@/components/ui"
import { Plus, Calendar } from "lucide-react"
import toast from "react-hot-toast"
import { getDateLocale } from "@/lib/locale"

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
  const locale = useLocale()
  const t = useTranslations("academicYearsPage")
  const tStatus = useTranslations("status")
  const tCommon = useTranslations("common")
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
    if (!yearName || !yearStart || !yearEnd) { toast.error(t("fillFields")); return }

    const result = editYear
      ? await academicYearsApi.update({ id: editYear.id, name: yearName, startsAt: yearStart, endsAt: yearEnd })
      : await academicYearsApi.create({ name: yearName, startsAt: yearStart, endsAt: yearEnd })

    if (result.error) toast.error(result.error)
    else {
      toast.success(editYear ? t("yearUpdated") : t("yearCreated"))
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
    else { toast.success(t("yearActivated")); fetchYears() }
  }

  async function saveTerm() {
    if (!termName || !termStart || !termEnd || !selectedYear) { toast.error(t("fillFields")); return }
    const { error } = await termsApi.create({
      academicYearId: selectedYear.id, name: termName, startsAt: termStart, endsAt: termEnd, order: termOrder,
    })
    if (error) toast.error(error)
    else {
      toast.success(t("termAdded"))
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
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <Button onClick={openAddYear}>
          <Plus className="h-5 w-5" /> {t("newYear")}
        </Button>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editYear ? t("editYear") : t("addYear")}>
        <div className="space-y-4">
          <Input label={t("yearName")} value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder={t("yearNamePlaceholder")} />
          <Input label={t("startDate")} type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
          <Input label={t("endDate")} type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowModal(false)}>{tCommon("cancel")}</Button>
            <Button fullWidth onClick={saveYear}>{t("save")}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showTermModal} onClose={() => setShowTermModal(false)} title={t("addTermFor", { name: selectedYear?.name || "" })}>
        <div className="space-y-4">
          <Input label={t("termName")} value={termName} onChange={(e) => setTermName(e.target.value)} placeholder={t("termNamePlaceholder")} />
          <Input label={t("order")} type="number" value={termOrder} onChange={(e) => setTermOrder(e.target.value)} min="1" max="3" />
          <Input label={t("startDate")} type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} />
          <Input label={t("endDate")} type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setShowTermModal(false)}>{tCommon("cancel")}</Button>
            <Button fullWidth onClick={saveTerm}>{t("save")}</Button>
          </div>
        </div>
      </Modal>

      {loading ? (
        <Card><p className="text-center text-gray-400 py-8">جاري التحميل...</p></Card>
      ) : years.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{t("noYears")}</p>
            <p className="text-sm text-gray-400 mt-1">{t("addFirstYear")}</p>
            <Button className="mt-4" onClick={openAddYear}>
              <Plus className="h-5 w-5" /> {t("addYear")}
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
                      {new Date(year.startsAt).toLocaleDateString(getDateLocale(locale))} → {new Date(year.endsAt).toLocaleDateString(getDateLocale(locale))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {year.isActive ? (
                    <Badge variant="success">{t("activeFemale")}</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => activateYear(year)}>{t("activate")}</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEditYear(year)}>{tCommon("edit")}</Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">{t("terms")}</span>
                  <Button variant="secondary" size="sm" onClick={() => { setSelectedYear(year); setShowTermModal(true) }}>
                    <Plus className="h-4 w-4" /> {t("addTerm")}
                  </Button>
                </div>

                {year.terms.length === 0 ? (
                  <p className="text-sm text-gray-400">{t("noTerms")}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {year.terms.sort((a, b) => a.order - b.order).map((term) => (
                      <div key={term.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{term.name}</span>
                          <Badge variant={term.isActive ? "success" : "default"}>
                            {term.isActive ? tStatus("active") : tStatus("inactive")}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(term.startsAt).toLocaleDateString(getDateLocale(locale))} → {new Date(term.endsAt).toLocaleDateString(getDateLocale(locale))}
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
