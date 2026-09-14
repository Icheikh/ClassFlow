"use client"

import { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Card, Button } from "@/components/ui"
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowLeft, Download } from "lucide-react"
import toast from "react-hot-toast"

type ImportResult = {
  created: number
  skipped: number
  errors: { row: number; error: string }[]
}

export default function StudentImportPage() {
  const t = useTranslations("students")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/school/students/import", { method: "POST", body: formData })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || "Import failed")
      setImporting(false)
      return
    }
    setResult(data)
    setImporting(false)
    if (data.created > 0) toast.success(`${data.created} students imported`)
    if (data.errors.length > 0) toast.error(`${data.errors.length} rows had errors`)
  }

  const downloadTemplate = () => {
    const csv = "firstName,lastName,gender,birthDate,phone,address,parentName,parentPhone\n"
      + "محمد,عبدالله,male,2010-05-15,+22212345678,ancienne capitale,فاطمة بنت محمد,+22212345679\n"
      + "أحمد,والي,male,2011-03-20,,conakry,عمر ولد أحمد,+22298765432\n"
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "students-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => router.push("/school/students")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCommon("back")}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("importTitle")}</h1>
          <p className="text-sm text-gray-500">{t("importSubtitle")}</p>
        </div>
      </div>

      <Card padding="lg">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{t("importTemplateHint")}</p>
            <Button variant="secondary" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t("downloadTemplate")}
            </Button>
          </div>

          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{file.name}</span>
                <span className="text-sm text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">{t("dropCsv")}</p>
              </div>
            )}
          </div>

          <Button onClick={handleImport} disabled={!file || importing} className="w-full">
            {importing ? t("importing") : t("importStudents")}
          </Button>
        </div>
      </Card>

      {result && (
        <Card padding="lg">
          <h2 className="text-lg font-bold mb-4">{t("importResults")}</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>{result.created} {t("studentsImported")}</span>
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span>{result.errors.length} {t("rowsFailed")}</span>
                </div>
                <div className="max-h-40 overflow-y-auto text-sm">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-red-500">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4">
            <Button onClick={() => router.push("/school/students")}>
              {t("viewStudents")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
