import Link from "next/link"
import { Users, GraduationCap, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"

type TeacherSubNavProps = {
  current: "attendance" | "grades" | "lessons"
  classroomId?: string
  subjectId?: string
}

const links = [
  { id: "attendance" as const, label: "الغياب", icon: Users, href: "/teacher/attendance" },
  { id: "grades" as const, label: "النقاط", icon: GraduationCap, href: "/teacher/grades" },
  { id: "lessons" as const, label: "الدروس", icon: BookOpen, href: "/teacher/lessons" },
]

export function TeacherSubNav({ current, classroomId, subjectId }: TeacherSubNavProps) {
  const query = classroomId && subjectId ? `?classroomId=${classroomId}&subjectId=${subjectId}` : ""

  return (
    <nav className="flex gap-1 mb-6 p-1 bg-gray-50 rounded-lg" aria-label="التنقل بين صفحات المعلم">
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
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
