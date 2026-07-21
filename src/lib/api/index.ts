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
// School Students (CRUD)
// ============================================================

export type SchoolStudent = {
  id: string
  firstName: string
  lastName: string
  gender: string | null
  birthDate: string | null
  studentNumber: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  enrollments?: {
    id: string
    status: string
    classroom: { id: string; name: string; level: { name: string } }
    academicYear: { id: string; name: string }
  }[]
}

export type StudentListResponse = {
  students: SchoolStudent[]
  total: number
  page: number
  limit: number
}

export const schoolStudentsApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set("search", params.search)
    if (params?.page) q.set("page", String(params.page))
    if (params?.limit) q.set("limit", String(params.limit))
    return api.get<StudentListResponse>(`/api/school/students?${q}`)
  },
  get: (id: string) => api.get<SchoolStudent>(`/api/school/students/${id}`),
  create: (data: { firstName: string; lastName: string; gender?: string; birthDate?: string; studentNumber?: string; address?: string; phone?: string }) =>
    api.post("/api/school/students", data),
  update: (id: string, data: { firstName?: string; lastName?: string; gender?: string | null; birthDate?: string | null; studentNumber?: string; address?: string; phone?: string; isActive?: boolean }) =>
    api.put(`/api/school/students/${id}`, data),
}

export const enrollmentsApi = {
  list: (params?: { classroomId?: string; academicYearId?: string; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.classroomId) q.set("classroomId", params.classroomId)
    if (params?.academicYearId) q.set("academicYearId", params.academicYearId)
    if (params?.status) q.set("status", params.status)
    return api.get<any[]>(`/api/school/enrollments?${q}`)
  },
  create: (data: { studentId: string; classroomId: string; academicYearId: string }) =>
    api.post("/api/school/enrollments", data),
  delete: (id: string) => api.delete(`/api/school/enrollments?id=${id}`),
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

export type DashboardActionItem = {
  key: string
  title: string
  description: string
  count: number
  href: string
  tone: "danger" | "warning" | "info" | "success"
}

export type DashboardChecklistItem = {
  key: string
  title: string
  description: string
  done: number
  total: number
  href: string
}

export type DashboardHealthItem = {
  key: string
  title: string
  description: string
  count: number
  href: string
  status: "good" | "warning" | "danger"
}

export type DashboardMonthMetric = {
  key: string
  label: string
  value: number
  href: string
}

export type DashboardStats = {
  schoolName: string | null
  today: string
  activeYearName: string | null
  activeTermName: string | null
  stats: {
    students: number
    teachers: number
    classrooms: number
    todayAbsences: number
    activeEnrollments: number
    pendingApprovals: number
    overdueInvoices: number
    todayLessons: number
  }
  attentionItems: DashboardActionItem[]
  dailyChecklist: DashboardChecklistItem[]
  monthlySnapshot: DashboardMonthMetric[]
  healthChecks: DashboardHealthItem[]
}

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/api/dashboard/stats"),
}
