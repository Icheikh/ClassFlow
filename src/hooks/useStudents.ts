import { useState, useEffect } from "react"
import { studentsApi, type Student } from "@/lib/api"

export function useStudents(classroomId: string) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classroomId) return
    studentsApi.listByClass(classroomId).then(({ data }) => {
      if (data) setStudents(data)
      setLoading(false)
    })
  }, [classroomId])

  return { students, loading }
}