"use client"

import { useSession } from "next-auth/react"
import { ClipboardCheck, BookOpen, GraduationCap } from "lucide-react"

export default function TeacherPage() {
  const { data: session } = useSession()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">مرحباً، {session?.user?.name}</h1>
      <p className="text-gray-500 mb-8">اختر أحد الدفاتر للبدء</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/teacher/attendance"
          className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <ClipboardCheck className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">دفتر الغياب</h2>
          <p className="text-sm text-gray-500">سجل غياب التلاميذ وأرسل الإشعارات</p>
        </a>

        <a
          href="/teacher/lessons"
          className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">دفتر الدروس</h2>
          <p className="text-sm text-gray-500">سجل عناوين الدروس والواجبات</p>
        </a>

        <a
          href="/teacher/grades"
          className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <GraduationCap className="h-6 w-6 text-purple-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">دفتر النقاط</h2>
          <p className="text-sm text-gray-500">أدخل النتائج واحسب المعدلات</p>
        </a>
      </div>
    </div>
  )
}