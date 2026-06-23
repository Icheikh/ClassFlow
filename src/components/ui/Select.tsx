"use client"

import * as RadixSelect from "@radix-ui/react-select"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string }

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  label?: string
  className?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "اختر...",
  label,
  className,
}: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <RadixSelect.Root value={value} onValueChange={onChange}>
          <RadixSelect.Trigger
            className={cn(
              "flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg bg-white",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "text-right",
              !value && "text-gray-400",
              className
            )}
          >
            <RadixSelect.Value placeholder={placeholder} />
            <RadixSelect.Icon>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>
          <RadixSelect.Portal>
            <RadixSelect.Content className="bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <RadixSelect.Viewport className="p-1">
                <RadixSelect.Item value="" className="hidden" />
                {options.map((opt) => (
                  <RadixSelect.Item
                    key={opt.value}
                    value={opt.value}
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
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
    </div>
  )
}