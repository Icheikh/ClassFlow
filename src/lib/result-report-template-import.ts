import path from "node:path"
import type { TemplateContentInput } from "@/lib/result-report-templates"

const TITLE_KEYWORDS = ["كشف", "نتائج", "بيان", "لائحة"]
const NOTES_KEYWORDS = ["ملاحظ", "ملاحظة"]
const SIGNATURE_KEYWORDS = ["توقيع", "الختم", "اعتماد"]
const CLASSROOM_KEYWORDS = ["القسم", "الشعبة", "المستوى"]
const TERM_KEYWORDS = ["الفصل", "الدورة", "المرحلة"]
const STATS_KEYWORDS = ["إحص", "المعدل", "النتائج"]
const MAX_PREVIEW_LINES = 40
const MAX_PREVIEW_LENGTH = 4000

type ImportedTemplateSource = {
  content: TemplateContentInput
  metadata: {
    sourceType: "WORD" | "EXCEL"
    fileName: string
    lineCount: number
    sheetCount?: number
  }
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

function takePreview(lines: string[]) {
  return lines.join("\n").slice(0, MAX_PREVIEW_LENGTH).trim() || null
}

function findLine(lines: string[], keywords: string[]) {
  return lines.find((line) => keywords.some((keyword) => line.includes(keyword))) || null
}

function inferTemplateContent(params: {
  fileName: string
  sourceType: "WORD" | "EXCEL"
  lines: string[]
  sheetCount?: number
}): ImportedTemplateSource {
  const { fileName, sourceType, lines, sheetCount } = params
  const previewLines = lines.slice(0, MAX_PREVIEW_LINES)
  const titleCandidates = previewLines.filter(
    (line) => !line.startsWith("ورقة:") && !line.startsWith("القسم") && !line.startsWith("إحصاءات")
  )
  const title =
    findLine(titleCandidates, TITLE_KEYWORDS) ||
    titleCandidates.find((line) => line.length <= 90) ||
    "كشف نتائج القسم"
  const subtitle =
    titleCandidates.find((line) => line !== title && line.length <= 120) ||
    `مرجع مستورد من ${sourceType === "WORD" ? "Word" : "Excel"}`
  const notesLabel = findLine(lines, NOTES_KEYWORDS) || "ملاحظات الإدارة"
  const signatureLabel = findLine(lines, SIGNATURE_KEYWORDS) || "الختم والتوقيع"
  const classroomLabel = findLine(lines, CLASSROOM_KEYWORDS) || "القسم"
  const termLabel = findLine(lines, TERM_KEYWORDS) || "الفصل"
  const statsLabel = findLine(lines, STATS_KEYWORDS) || "إحصاءات"
  const preview = takePreview(previewLines)
  const sourceDescriptionParts = [
    `تم استيراد القالب من ملف ${sourceType === "WORD" ? "Word" : "Excel"}.`,
    `المرجع الأصلي: ${fileName}.`,
    `عدد الأسطر المستخرجة: ${lines.length}.`,
  ]

  if (sheetCount) {
    sourceDescriptionParts.push(`عدد الأوراق: ${sheetCount}.`)
  }

  return {
    content: {
      name: path.parse(fileName).name || "قالب مستورد",
      sourceType,
      sourceFileName: fileName,
      sourceDescription: sourceDescriptionParts.join(" "),
      sourcePreview: preview,
      title,
      subtitle,
      footerNote: "تم توليد هذا الكشف داخل النظام انطلاقاً من مرجع المدرسة المستورد.",
      notesLabel,
      signatureLabel,
      classroomLabel,
      termLabel,
      statsLabel,
    },
    metadata: {
      sourceType,
      fileName,
      lineCount: lines.length,
      sheetCount,
    },
  }
}

async function importWordTemplate(buffer: Buffer, fileName: string) {
  const mammothModule = (await import("mammoth")) as any
  const mammothApi = mammothModule.extractRawText ? mammothModule : mammothModule.default
  const result = await mammothApi.extractRawText({ buffer })
  const lines = normalizeText(result.value)

  if (lines.length === 0) {
    throw new Error("لم يتم العثور على نص قابل للقراءة داخل ملف Word")
  }

  return inferTemplateContent({
    fileName,
    sourceType: "WORD",
    lines,
  })
}

async function importExcelTemplate(buffer: Buffer, fileName: string) {
  const xlsxModule = (await import("xlsx")) as any
  const xlsxApi = xlsxModule.read ? xlsxModule : xlsxModule.default
  const workbook = xlsxApi.read(buffer, { type: "buffer" })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = xlsxApi.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    }) as Array<Array<number | string | null>>

    if (!rows.length) continue

    lines.push(`ورقة: ${sheetName}`)
    for (const row of rows) {
      const rowText = row
        .map((cell) => String(cell || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" | ")

      if (rowText) {
        lines.push(rowText)
      }
    }
  }

  const normalizedLines = normalizeText(lines.join("\n"))
  if (normalizedLines.length === 0) {
    throw new Error("لم يتم العثور على بيانات قابلة للقراءة داخل ملف Excel")
  }

  return inferTemplateContent({
    fileName,
    sourceType: "EXCEL",
    lines: normalizedLines,
    sheetCount: workbook.SheetNames.length,
  })
}

export async function importResultReportTemplateFromFile(fileName: string, buffer: Buffer) {
  const extension = path.extname(fileName).toLowerCase()

  if (extension === ".docx") {
    return importWordTemplate(buffer, fileName)
  }

  if (extension === ".xlsx" || extension === ".xls") {
    return importExcelTemplate(buffer, fileName)
  }

  throw new Error("نوع الملف غير مدعوم. يرجى رفع ملف Word أو Excel")
}
