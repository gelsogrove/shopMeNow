import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface Field {
  name: string
  label: string
  type: "text" | "number" | "select"
  defaultValue?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
  description?: string
  min?: string
  max?: string
  step?: string
  pattern?: string
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: Field[]
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isWide?: boolean
  submitButtonClassName?: string
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  onSubmit,
  isWide,
  submitButtonClassName,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("sm:max-w-[425px]", isWide && "sm:max-w-[800px]")}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.description && (
                <p className="text-sm text-muted-foreground">{field.description}</p>
              )}
              {field.type === "select" && field.options ? (
                <Select 
                  name={field.name} 
                  defaultValue={field.defaultValue}
                  required={field.required}
                >
                  <SelectTrigger aria-label={field.label}>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem 
                        key={option.value} 
                        value={option.value}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  defaultValue={field.defaultValue}
                  required={field.required}
                  min={field.type === "number" ? field.min : undefined}
                  max={field.type === "number" ? field.max : undefined}
                  step={field.type === "number" ? field.step : undefined}
                  pattern={field.pattern}
                  aria-label={field.label}
                  aria-describedby={field.description ? `${field.name}-description` : undefined}
                />
              )}
              {field.description && (
                <p id={`${field.name}-description`} className="text-sm text-muted-foreground">
                  {field.description}
                </p>
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
            <Button type="submit" className={submitButtonClassName} aria-label="Save changes">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
