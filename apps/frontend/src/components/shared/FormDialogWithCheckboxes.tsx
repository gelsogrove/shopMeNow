import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface Field {
  name: string
  label: string
  type:
    | "text"
    | "textarea"
    | "select"
    | "number"
    | "markdown"
    | "checkbox-group"
    | "image-preview"
  options?: string[]
  defaultValue?: string | string[]
  multiple?: boolean
  className?: string
  min?: number
  max?: number
  step?: number
  isWide?: boolean
}

interface FormDialogWithCheckboxesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: Field[]
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isWide?: boolean
  submitButtonClassName?: string
}

export function FormDialogWithCheckboxes({
  open,
  onOpenChange,
  title,
  fields,
  onSubmit,
  isWide,
  submitButtonClassName,
}: FormDialogWithCheckboxesProps) {
  // State to track checkboxes
  const [checkedOptions, setCheckedOptions] = useState<
    Record<string, Set<string>>
  >({})
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  // Initialize checkedOptions and imageUrls on mount and when defaultValue changes
  useEffect(() => {
    const newCheckedOptions: Record<string, Set<string>> = {}
    const newImageUrls: Record<string, string> = {}

    fields.forEach((field) => {
      if (field.type === "checkbox-group" && field.options) {
        const fieldSet = new Set<string>()

        if (Array.isArray(field.defaultValue)) {
          field.defaultValue.forEach((value) => fieldSet.add(value))
        }

        newCheckedOptions[field.name] = fieldSet
      }

      if (
        field.type === "image-preview" &&
        typeof field.defaultValue === "string"
      ) {
        newImageUrls[field.name] = field.defaultValue
      }
    })

    setCheckedOptions(newCheckedOptions)
    setImageUrls(newImageUrls)
  }, [fields, open])

  // Handle checkbox change
  const handleCheckboxChange = (
    fieldName: string,
    option: string,
    checked: boolean
  ) => {
    setCheckedOptions((prev) => {
      const newSet = new Set(prev[fieldName])

      if (checked) {
        newSet.add(option)
      } else {
        newSet.delete(option)
      }

      return {
        ...prev,
        [fieldName]: newSet,
      }
    })
  }

  // Handle image URL change
  const handleImageUrlChange = (fieldName: string, value: string) => {
    setImageUrls((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
  }

  // Custom submit handler to handle checkboxes
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Add hidden inputs for checkbox values
    const form = e.target as HTMLFormElement

    for (const [fieldName, values] of Object.entries(checkedOptions)) {
      // Remove existing hidden inputs for this field
      form
        .querySelectorAll(`input[name="${fieldName}"]`)
        .forEach((el) => el.remove())

      // Add new hidden inputs for checked values
      values.forEach((value) => {
        const input = document.createElement("input")
        input.type = "hidden"
        input.name = fieldName
        input.value = value
        form.appendChild(input)
      })
    }

    // Call original onSubmit
    onSubmit(e)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-[425px]", isWide && "sm:max-w-[800px]")}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div
              key={field.name}
              className={cn("space-y-2", field.isWide && "col-span-2")}
            >
              <label
                htmlFor={field.name}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {field.label}
              </label>

              {field.type === "checkbox-group" ? (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {field.options?.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${field.name}-${option}`}
                        checked={checkedOptions[field.name]?.has(option)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(
                            field.name,
                            option,
                            checked === true
                          )
                        }
                      />
                      <Label
                        htmlFor={`${field.name}-${option}`}
                        className="text-sm cursor-pointer"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : field.type === "image-preview" ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    id={field.name}
                    name={field.name}
                    defaultValue={field.defaultValue as string}
                    onChange={(e) =>
                      handleImageUrlChange(field.name, e.target.value)
                    }
                    placeholder="Inserisci l'URL dell'immagine"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="rounded-md overflow-hidden border border-gray-200 bg-gray-50 h-48 flex items-center justify-center">
                    {imageUrls[field.name] ? (
                      <img
                        src={imageUrls[field.name]}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).src =
                            "https://placehold.co/400x300?text=Immagine+non+valida"
                          ;(
                            e.target as HTMLImageElement
                          ).parentElement?.classList.add(
                            "border-red-500",
                            "border-2"
                          )
                        }}
                      />
                    ) : (
                      <div className="text-gray-400 text-center p-4">
                        <div className="mb-2">Anteprima immagine</div>
                        <div className="text-sm">
                          Inserisci un URL valido per visualizzare l'anteprima
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : field.type === "markdown" || field.type === "textarea" ? (
                <textarea
                  id={field.name}
                  name={field.name}
                  defaultValue={field.defaultValue as string}
                  className={cn(
                    "flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    field.className
                  )}
                />
              ) : field.type === "select" ? (
                <select
                  id={field.name}
                  name={field.name}
                  defaultValue={field.defaultValue}
                  multiple={field.multiple}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === "number" ? (
                <input
                  type="number"
                  id={field.name}
                  name={field.name}
                  defaultValue={field.defaultValue}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              ) : (
                <input
                  type="text"
                  id={field.name}
                  name={field.name}
                  defaultValue={field.defaultValue as string}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}
            </div>
          ))}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-white text-black hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button type="submit" className={submitButtonClassName}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
