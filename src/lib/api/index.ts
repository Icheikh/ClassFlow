import { api } from "./client"
export { api }

// ============================================================
// Teacher Assignments (replaces old ClassInfo)
// ============================================================

export type TeacherAssignment = {
  id: string
  schoolId: string
  teacherId: string
  subjectId: string
  classroomId: string
  academicYearId: string
  isActive: boolean
  classroom: { id: string; name: string; level?: { name: string }; stream?: { name: string } | null }
  subject: { id: string; nameAr: string; nameFr: string | null; code: string | null }
  teacher?: { id: string; user: { name: string } }
}

export const assignmentsApi = {
  list: () => api.get<TeacherAssignment[]>("/api/teacher/classes"),
}

// ============================================================
// Students
// ============================================================

export type Student = {
  id: string
  firstName: string
  lastName: string
  gender: string | null
  studentNumber: string | null
  isActive: boolean
}

export const studentsApi = {
  listByClass: (classroomId: string) =>
    api.get<Student[]>(`/api/students?classroomId=${classroomId}`),
}

// ============================================================
// Attendance
// ============================================================

export type AttendanceRecord = {
  id: string
  studentId: string
  status: string
  date: string
  student: { firstName: string; lastName: string }
}

type AttendancePayload = {
  classroomId: string
  subjectId: string
  date: string
  records: { studentId: string; status: string }[]
}

export const attendanceApi = {
  list: (classroomId: string, subjectId: string, date?: string) => {
    const today = date || new Date().toISOString().split("T")[0]
    return api.get<AttendanceRecord[]>(
      `/api/attendance?classroomId=${classroomId}&subjectId=${subjectId}&date=${today}`
    )
  },
  save: (payload: AttendancePayload) => api.post("/api/attendance", payload),
}

// ============================================================
// Lessons
// ============================================================

export type Lesson = {
  id: string
  title: string
  description: string | null
  homework: string | null
  notes: string | null
  status: string
  date: string
  classroom: { name: string }
  subject: { nameAr: string; nameFr: string | null }
}

type LessonPayload = {
  title: string
  description?: string
  homework?: string
  notes?: string
  classroomId: string
  subjectId: string
}

export const lessonsApi = {
  list: (classroomId: string, subjectId: string) =>
    api.get<Lesson[]>(`/api/lessons?classroomId=${classroomId}&subjectId=${subjectId}`),
  create: (payload: LessonPayload) => api.post("/api/lessons", payload),
}

// ============================================================
// Grades
// ============================================================

export type GradeRecord = {
  id: string
  assessmentType: string
  label: string
  score: number
  maxScore: number
  status: string
  date: string
  student: { firstName: string; lastName: string }
  subject: { nameAr: string }
}

type GradePayload = {
  scores: { studentId: string; score: number }[]
  assessmentType: string
  label: string
  classroomId: string
  subjectId: string
  termId: string
}

export const gradesApi = {
  list: (classroomId: string, subjectId: string) =>
    api.get<GradeRecord[]>(`/api/grades?classroomId=${classroomId}&subjectId=${subjectId}`),
  save: (payload: GradePayload) => api.post("/api/grades", payload),
}

// ============================================================
// Dashboard
// ============================================================

export type DashboardStats = {
  students: number
  teachers: number
  classrooms: number
  todayAbsences: number
  activeEnrollments: number
}

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/api/dashboard/stats"),
}