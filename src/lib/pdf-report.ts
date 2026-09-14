import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type SubjectResult = {
  subjectName: string
  coefficient: number
  testAverage: number | null
  examAverage: number | null
  finalAverage: number | null
  weightedScore: number
}

type StudentRow = {
  rank: number
  studentName: string
  average: number | null
  subjects: SubjectResult[]
}

type ReportData = {
  schoolName: string
  classroomName: string
  levelName: string
  termName: string
  academicYearName: string
  subjectNames: string[]
  students: StudentRow[]
  generatedAt: string
}

export function generateResultReportPDF(data: ReportData): Buffer {
  const doc = new jsPDF({
    orientation: data.subjectNames.length > 4 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10

  // Title
  doc.setFontSize(14)
  doc.text(data.schoolName, pageWidth / 2, margin + 5, { align: "center" })
  doc.setFontSize(10)
  doc.text(`${data.classroomName} — ${data.levelName}`, pageWidth / 2, margin + 12, { align: "center" })
  doc.text(`${data.termName} — ${data.academicYearName}`, pageWidth / 2, margin + 18, { align: "center" })

  // Table headers
  const baseHeaders = ["#", "الاسم"]
  const subjectHeaders = data.subjectNames.map((name) =>
    name.length > 8 ? name.slice(0, 8) + "." : name
  )
  const summaryHeaders = ["المعدل", "الترتيب"]
  const headers = [...baseHeaders, ...subjectHeaders, ...summaryHeaders]

  // Table rows
  const rows = data.students.map((student) => {
    const base = [String(student.rank), student.studentName]
    const subjectScores = data.subjectNames.map((name) => {
      const subject = student.subjects.find((s) => s.subjectName === name)
      if (!subject || subject.finalAverage == null) return "—"
      return String(subject.finalAverage)
    })
    const avg = student.average != null ? String(student.average) : "—"
    const rank = student.average != null ? String(student.rank) : "—"
    return [...base, ...subjectScores, avg, rank]
  })

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: margin + 24,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { halign: "right", cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  })

  // Footer
  const finalY = (doc as any).lastAutoTable?.finalY || margin + 30
  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text(
    `تم إنشاء هذا التقرير في ${data.generatedAt} — ClassFlow`,
    pageWidth / 2,
    finalY + 8,
    { align: "center" }
  )

  const buffer = Buffer.from(doc.output("arraybuffer"))
  return buffer
}
