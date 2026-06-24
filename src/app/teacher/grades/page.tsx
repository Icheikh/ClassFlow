"use client"

import { Suspense } from "react"
import { SessionProvider } from "next-auth/react"
import { GradeBook } from "@/features/grades/components/GradeBook"
import { LoadingPage } from "@/components/ui"

function GradesContent() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <GradeBook />
    </Suspense>
  )
}

export default function GradesPage() {
  return (
    <SessionProvider>
      <GradesContent />
    </SessionProvider>
  )
}
