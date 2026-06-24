"use client"

import { Suspense } from "react"
import { SessionProvider } from "next-auth/react"
import { AttendanceSheet } from "@/features/attendance/components/AttendanceSheet"
import { LoadingPage } from "@/components/ui"

function AttendanceContent() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <AttendanceSheet />
    </Suspense>
  )
}

export default function AttendancePage() {
  return (
    <SessionProvider>
      <AttendanceContent />
    </SessionProvider>
  )
}
