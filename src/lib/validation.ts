import { z } from "zod"

export const createStudentSchema = z.object({
  firstName: z.string().min(1, "الاسم الأول مطلوب").max(50),
  lastName: z.string().min(1, "اسم العائلة مطلوب").max(50),
  gender: z.enum(["MALE", "FEMALE"]).optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  parentName: z.string().max(100).optional().or(z.literal("")),
  parentPhone: z.string().max(20).optional().or(z.literal("")),
  parentEmail: z.string().email("بريد غير صالح").optional().or(z.literal("")),
  studentNumber: z.string().optional(),
})

export const updateStudentSchema = createStudentSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const attendanceRecordSchema = z.object({
  studentId: z.string().cuid(),
  status: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(["PRESENT", "ABSENT"])),
})

export const saveAttendanceSchema = z.object({
  scheduleId: z.string().cuid().optional().or(z.literal("")),
  classroomId: z.string().cuid(),
  subjectId: z.string().cuid(),
  date: z.string().min(1, "التاريخ مطلوب"),
  records: z.array(attendanceRecordSchema).min(1, "لا يوجد طلاب"),
})

export const createEnrollmentSchema = z.object({
  studentId: z.string().cuid(),
  classroomId: z.string().cuid(),
  academicYearId: z.string().cuid(),
})

export function parseOrError<T>(schema: z.ZodSchema<T>, data: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { data: result.data }
  const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
  return { error: message }
}
