"use client"

import Link from "next/link"
import { Users, GraduationCap, BookOpen } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

type TeacherSubNavProps = {
  current: "attendance" | "grades" | "lessons"
  classroomId?: string
  subjectId?: string
}

const links = [
  { id: "attendance" as const, labelKey: "attendance", icon: Users, href: "/teacher/attendance" },
  { id: "grades" as const, labelKey: "grades", icon: GraduationCap, href: "/teacher/grades" },
  { id: "lessons" as const, labelKey: "lessons", icon: BookOpen, href: "/teacher/lessons" },
]

export function TeacherSubNav({ current, classroomId, subjectId }: TeacherSubNavProps) {
  const tTeacher = useTranslations("teacher")
  const tSubNav = useTranslations("teacherSubNav")
  const query = classroomId && subjectId ? `?classroomId=${classroomId}&subjectId=${subjectId}` : ""

  return (
    <nav className="mb-6 flex gap-1 rounded-lg bg-gray-50 p-1" aria-label={tSubNav("label")}>
      {links.map((link) => {
        const isActive = link.id === current
        return (
          <Link
            key={link.id}
            href={`${link.href}${query}`}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-gray-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <link.icon className="h-4 w-4" aria-hidden="true" />
            {tTeacher(link.labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}
