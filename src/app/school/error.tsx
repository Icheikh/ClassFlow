"use client"

export default function SchoolError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" role="alert">
      <h2 className="text-xl font-bold text-red-600">حدث خطأ</h2>
      <p className="text-gray-500 text-sm">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        إعادة المحاولة
      </button>
    </div>
  )
}
