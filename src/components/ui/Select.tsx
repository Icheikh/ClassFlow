"use client"

import * as RadixSelect from "@radix-ui/react-select"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

const EMPTY_VALUE_SENTINEL = "__select_empty__"

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  id?: string
  className?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "اختر...",
  label,
  error,
  disabled = false,
  id,
  className,
}: SelectProps) {
  const normalizedValue = value === "" ? EMPTY_VALUE_SENTINEL : value
  const errorId = id && error ? `${id}-error` : undefined

  return (
    <div className="space-y-1">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
      <RadixSelect.Root
        value={normalizedValue}
        onValueChange={(nextValue) => onChange(nextValue === EMPTY_VALUE_SENTINEL ? "" : nextValue)}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          className={cn(
            "flex items-center justify-between w-full px-4 py-2 border rounded-lg bg-white transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "text-right",
            !value && "text-gray-400",
            error ? "border-red-500" : "border-gray-300",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content className="bg-white border border-gray-200 rounded-lg shadow-lg z-[60]">
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => {
                const optionValue = opt.value === "" ? EMPTY_VALUE_SENTINEL : opt.value

                return (
                  <RadixSelect.Item
                    key={`${opt.label}-${optionValue}`}
                    value={optionValue}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer",
                      "hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
                      "data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700"
                    )}
                  >
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                )
              })}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <p id={errorId} className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  )
}
