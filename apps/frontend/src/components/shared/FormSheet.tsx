import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  submitLabel?: string
  className?: string
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  className,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-[90%] sm:w-[500px] md:w-[600px] overflow-y-auto",
          className
        )}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-6 space-y-8">
          {children}

          <div className="flex justify-end pt-4">
            <Button type="submit">
              {submitLabel}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
