"use client"

import { SessionProvider } from "next-auth/react"
import { AttendanceSheet } from "@/features/attendance/components/AttendanceSheet"

export default function AttendancePage() {
  return <AttendanceSheet />
}