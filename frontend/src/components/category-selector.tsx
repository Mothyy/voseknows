import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Category } from "@/pages/Categories"

interface CategorySelectorProps {
  categories: Category[]
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}

const flattenCategories = (
  categories: Category[],
  parentName: string = ""
): { id: string; name: string; label: string }[] => {
  let flat: { id: string; name: string; label: string }[] = []

  for (const cat of categories) {
    const label = parentName ? `${parentName} > ${cat.name}` : cat.name
    flat.push({ id: cat.id, name: cat.name, label })
    if (cat.children && cat.children.length > 0) {
      flat = flat.concat(flattenCategories(cat.children, label))
    }
  }
  return flat
}

export function CategorySelector({
  categories,
  value,
  onChange,
  disabled,
}: CategorySelectorProps) {
  const [open, setOpen] = React.useState(false)
  const flatCategories = React.useMemo(() => flattenCategories(categories), [categories])

  const selectedCategory = value === "uncategorized"
    ? { label: "Uncategorized" }
    : flatCategories.find((category) => category.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedCategory ? selectedCategory.label : "Select category..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search category..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="uncategorized"
                onSelect={() => {
                  onChange("uncategorized")
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "uncategorized" ? "opacity-100" : "opacity-0"
                  )}
                />
                Uncategorized
              </CommandItem>
              {flatCategories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.label}
                  onSelect={() => {
                    onChange(category.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {category.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
