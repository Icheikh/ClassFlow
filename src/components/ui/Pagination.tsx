import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./Button"

type PaginationProps = {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
}

export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  if (total <= limit) return null

  const pages: number[] = []
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-between pt-4 text-sm">
      <p className="text-gray-500">
        {from}–{to} من {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="الصفحة السابقة">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {pages[0] > 1 && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onChange(1)}>1</Button>
            {pages[0] > 2 && <span className="px-1 text-gray-400">...</span>}
          </>
        )}
        {pages.map((p) => (
          <Button
            key={p}
            variant={p === page ? "primary" : "ghost"}
            size="sm"
            onClick={() => onChange(p)}
            aria-label={`الصفحة ${p}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Button>
        ))}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
            <Button variant="ghost" size="sm" onClick={() => onChange(totalPages)}>{totalPages}</Button>
          </>
        )}
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="الصفحة التالية">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
