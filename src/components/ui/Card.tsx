import { cn } from "@/lib/utils"

type CardProps = {
  children: React.ReactNode
  className?: string
  padding?: "sm" | "md" | "lg"
  hover?: boolean
}

const paddings = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
}

export function Card({ children, className, padding = "md", hover = false }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border shadow-sm",
        paddings[padding],
        hover && "hover:shadow-md transition-shadow cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-between mb-4", className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-lg font-semibold", className)}>{children}</h3>
}