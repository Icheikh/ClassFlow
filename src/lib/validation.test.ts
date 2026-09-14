import { describe, expect, it } from "vitest"
import {
  createStudentSchema,
  attendanceRecordSchema,
  saveAttendanceSchema,
  parseOrError,
} from "./validation"

describe("createStudentSchema", () => {
  it("accepts valid student data", () => {
    const result = createStudentSchema.safeParse({
      firstName: "أحمد",
      lastName: "محمد",
      gender: "MALE",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing firstName", () => {
    const result = createStudentSchema.safeParse({
      lastName: "محمد",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing lastName", () => {
    const result = createStudentSchema.safeParse({
      firstName: "أحمد",
    })
    expect(result.success).toBe(false)
  })

  it("accepts empty optional fields", () => {
    const result = createStudentSchema.safeParse({
      firstName: "أحمد",
      lastName: "محمد",
      gender: "",
      birthDate: "",
      phone: "",
    })
    expect(result.success).toBe(true)
  })
})

describe("attendanceRecordSchema", () => {
  it("accepts PRESENT status", () => {
    const result = attendanceRecordSchema.safeParse({
      studentId: "clxxx1234567890",
      status: "PRESENT",
    })
    expect(result.success).toBe(true)
  })

  it("accepts lowercase status and transforms to uppercase", () => {
    const result = attendanceRecordSchema.safeParse({
      studentId: "clxxx1234567890",
      status: "absent",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("ABSENT")
    }
  })

  it("rejects invalid status", () => {
    const result = attendanceRecordSchema.safeParse({
      studentId: "clxxx1234567890",
      status: "LATE",
    })
    expect(result.success).toBe(false)
  })
})

describe("saveAttendanceSchema", () => {
  it("accepts valid attendance data", () => {
    const result = saveAttendanceSchema.safeParse({
      classroomId: "clxxx1234567890",
      subjectId: "clxxx1234567890",
      date: "2026-08-30",
      records: [
        { studentId: "clxxx1234567890", status: "PRESENT" },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty records array", () => {
    const result = saveAttendanceSchema.safeParse({
      classroomId: "clxxx1234567890",
      subjectId: "clxxx1234567890",
      date: "2026-08-30",
      records: [],
    })
    expect(result.success).toBe(false)
  })
})

describe("parseOrError", () => {
  it("returns data on success", () => {
    const result = parseOrError(createStudentSchema, {
      firstName: "أحمد",
      lastName: "محمد",
    })
    expect("data" in result).toBe(true)
  })

  it("returns error string on failure", () => {
    const result = parseOrError(createStudentSchema, {})
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(typeof result.error).toBe("string")
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})
