import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full px-4 py-2 border rounded-lg bg-white transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "placeholder:text-gray-400",
          error ? "border-red-500" : "border-gray-300",
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          "w-full px-4 py-2 border rounded-lg bg-white transition-colors resize-none",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "placeholder:text-gray-400",
          error ? "border-red-500" : "border-gray-300",
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}