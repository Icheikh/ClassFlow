import { cn } from "@/lib/utils"

type BadgeProps = {
  variant?: "default" | "success" | "warning" | "danger" | "info"
  children: React.ReactNode
  className?: string
}

const badgeVariants = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}