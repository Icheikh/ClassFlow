"use client"

import { Suspense } from "react"
import { SessionProvider } from "next-auth/react"
import { LessonBook } from "@/features/lessons/components/LessonBook"
import { LoadingPage } from "@/components/ui"

function LessonsContent() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <LessonBook />
    </Suspense>
  )
}

export default function LessonsPage() {
  return (
    <SessionProvider>
      <LessonsContent />
    </SessionProvider>
  )
}
