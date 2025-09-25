import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface Option {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "选择选项...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((v) => v !== optionValue))
    } else {
      onValueChange([...value, optionValue])
    }
  }

  const handleRemove = (optionValue: string) => {
    onValueChange(value.filter((v) => v !== optionValue))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-10 h-auto",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((selectedValue) => {
                const option = options.find((opt) => opt.value === selectedValue)
                return (
                  <Badge
                    key={selectedValue}
                    variant="secondary"
                    className="text-xs"
                  >
                    {option?.label}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemove(selectedValue)
                      }}
                    />
                  </Badge>
                )
              })
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-60 overflow-y-auto p-1">
          {options.map((option) => (
            <div
              key={option.value}
              className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-primary/10 hover:text-primary",
                value.includes(option.value) && "bg-primary text-primary-foreground"
              )}
              onClick={() => handleSelect(option.value)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value.includes(option.value) ? "opacity-100" : "opacity-0"
                )}
              />
              {option.label}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}