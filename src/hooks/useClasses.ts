import { useState, useEffect } from "react"
import { assignmentsApi, type TeacherAssignment } from "@/lib/api"

export function useClasses() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    assignmentsApi.list().then(({ data }) => {
      if (data) setAssignments(data)
      setLoading(false)
    })
  }, [])

  const classroomIds = [...new Set(assignments.map((a) => a.classroomId))]
  const classrooms = classroomIds.map((id) => ({
    id,
    name: assignments.find((a) => a.classroomId === id)?.classroom.name ?? "",
  }))

  const getSubjects = (classroomId: string) =>
    assignments
      .filter((a) => a.classroomId === classroomId)
      .map((a) => ({ id: a.subjectId, name: a.subject.nameAr }))

  return { assignments, classrooms, getSubjects, loading }
}