import { api } from "./client"

type AcademicYearData = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  isActive: boolean
}

export const academicYearsApi = {
  list: () => api.get<(AcademicYearData & { terms: any[] })[]>("/api/school/academic-years"),
  create: (data: { name: string; startsAt: string; endsAt: string }) =>
    api.post("/api/school/academic-years", data),
  update: (data: { id: string; name: string; startsAt: string; endsAt: string; isActive?: boolean }) =>
    api.put("/api/school/academic-years", data),
}

export const termsApi = {
  list: () => api.get<any[]>("/api/school/terms"),
  create: (data: { academicYearId: string; name: string; startsAt: string; endsAt: string; order: string }) =>
    api.post("/api/school/terms", data),
  update: (data: { id: string; name: string; startsAt: string; endsAt: string; order: string; isActive?: boolean }) =>
    api.put("/api/school/terms", data),
  delete: (id: string) => api.delete(`/api/school/terms?id=${id}`),
}