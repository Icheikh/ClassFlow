import { describe, expect, it } from "vitest"
import { hasPermission, hasAnyPermission, hasAllPermissions } from "./permissions"

const mockAdmin = { role: "SCHOOL_ADMIN", permissions: [] }
const mockSuperAdmin = { role: "SUPER_ADMIN", permissions: [] }
const mockTeacher = { role: "TEACHER", permissions: [] }
const mockStaffWithPermissions = {
  role: "STAFF",
  permissions: ["MANAGE_STUDENTS", "REVIEW_LESSONS", "VIEW_REPORTS"],
}
const mockStaffEmpty = { role: "STAFF", permissions: [] }
const mockSupervisor = { role: "SUPERVISOR", permissions: [] }
const mockAccountant = { role: "ACCOUNTANT", permissions: [] }
const mockParent = { role: "PARENT", permissions: [] }

describe("hasPermission", () => {
  it("SUPER_ADMIN has all permissions", () => {
    expect(hasPermission(mockSuperAdmin, "MANAGE_STUDENTS")).toBe(true)
    expect(hasPermission(mockSuperAdmin, "LOCK_GRADES")).toBe(true)
    expect(hasPermission(mockSuperAdmin, "RECORD_PAYMENTS")).toBe(true)
  })

  it("SCHOOL_ADMIN has all permissions", () => {
    expect(hasPermission(mockAdmin, "MANAGE_STUDENTS")).toBe(true)
    expect(hasPermission(mockAdmin, "SEND_NOTIFICATIONS")).toBe(true)
  })

  it("TEACHER with no explicit permissions returns false", () => {
    expect(hasPermission(mockTeacher, "MANAGE_STUDENTS")).toBe(false)
  })

  it("STAFF with specific permissions returns true", () => {
    expect(hasPermission(mockStaffWithPermissions, "MANAGE_STUDENTS")).toBe(true)
    expect(hasPermission(mockStaffWithPermissions, "REVIEW_LESSONS")).toBe(true)
  })

  it("STAFF without specific permission returns false", () => {
    expect(hasPermission(mockStaffWithPermissions, "MANAGE_FEES")).toBe(false)
    expect(hasPermission(mockStaffWithPermissions, "LOCK_GRADES")).toBe(false)
  })

  it("STAFF with empty permissions returns false", () => {
    expect(hasPermission(mockStaffEmpty, "MANAGE_STUDENTS")).toBe(false)
  })

  it("null user returns false", () => {
    expect(hasPermission(null, "MANAGE_STUDENTS")).toBe(false)
  })

  it("undefined user returns false", () => {
    expect(hasPermission(undefined, "MANAGE_STUDENTS")).toBe(false)
  })

  it("SUPERVISOR has student/teacher/classroom/academic permissions", () => {
    expect(hasPermission(mockSupervisor, "MANAGE_STUDENTS")).toBe(true)
    expect(hasPermission(mockSupervisor, "MANAGE_TEACHERS")).toBe(true)
    expect(hasPermission(mockSupervisor, "MANAGE_CLASSROOMS")).toBe(true)
    expect(hasPermission(mockSupervisor, "MANAGE_ACADEMIC_YEARS")).toBe(true)
    expect(hasPermission(mockSupervisor, "REVIEW_LESSONS")).toBe(true)
    expect(hasPermission(mockSupervisor, "VIEW_REPORTS")).toBe(true)
  })

  it("SUPERVISOR does NOT have finance permissions", () => {
    expect(hasPermission(mockSupervisor, "MANAGE_FEES")).toBe(false)
    expect(hasPermission(mockSupervisor, "RECORD_PAYMENTS")).toBe(false)
    expect(hasPermission(mockSupervisor, "VIEW_FINANCE_REPORTS")).toBe(false)
  })

  it("ACCOUNTANT has finance permissions", () => {
    expect(hasPermission(mockAccountant, "MANAGE_FEES")).toBe(true)
    expect(hasPermission(mockAccountant, "RECORD_PAYMENTS")).toBe(true)
    expect(hasPermission(mockAccountant, "VIEW_FINANCE_REPORTS")).toBe(true)
    expect(hasPermission(mockAccountant, "VIEW_REPORTS")).toBe(true)
  })

  it("ACCOUNTANT does NOT have student/teacher permissions", () => {
    expect(hasPermission(mockAccountant, "MANAGE_STUDENTS")).toBe(false)
    expect(hasPermission(mockAccountant, "MANAGE_TEACHERS")).toBe(false)
    expect(hasPermission(mockAccountant, "MANAGE_CLASSROOMS")).toBe(false)
  })

  it("PARENT has no permissions", () => {
    expect(hasPermission(mockParent, "MANAGE_STUDENTS")).toBe(false)
    expect(hasPermission(mockParent, "MANAGE_FEES")).toBe(false)
  })
})

describe("hasAnyPermission", () => {
  it("returns true if user has at least one permission", () => {
    expect(
      hasAnyPermission(mockStaffWithPermissions, ["MANAGE_FEES", "MANAGE_STUDENTS", "LOCK_GRADES"])
    ).toBe(true)
  })

  it("returns false if user has none of the permissions", () => {
    expect(
      hasAnyPermission(mockStaffEmpty, ["MANAGE_FEES", "MANAGE_STUDENTS"])
    ).toBe(false)
  })

  it("SUPER_ADMIN always returns true", () => {
    expect(
      hasAnyPermission(mockSuperAdmin, ["MANAGE_FEES", "LOCK_GRADES"])
    ).toBe(true)
  })

  it("empty permissions array returns false", () => {
    expect(hasAnyPermission(mockStaffWithPermissions, [])).toBe(false)
  })
})

describe("hasAllPermissions", () => {
  it("returns true if user has all permissions", () => {
    expect(
      hasAllPermissions(mockStaffWithPermissions, ["MANAGE_STUDENTS", "VIEW_REPORTS"])
    ).toBe(true)
  })

  it("returns false if user is missing one permission", () => {
    expect(
      hasAllPermissions(mockStaffWithPermissions, ["MANAGE_STUDENTS", "MANAGE_FEES"])
    ).toBe(false)
  })

  it("SUPER_ADMIN always returns true", () => {
    expect(
      hasAllPermissions(mockSuperAdmin, ["MANAGE_FEES", "LOCK_GRADES", "SEND_NOTIFICATIONS"])
    ).toBe(true)
  })

  it("empty permissions array returns true (vacuous truth)", () => {
    expect(hasAllPermissions(mockStaffEmpty, [])).toBe(true)
  })
})
