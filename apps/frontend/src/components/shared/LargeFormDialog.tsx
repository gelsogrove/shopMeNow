import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface LargeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  submitLabel?: string
  className?: string
}

/**
 * A large centred modal for editing content, as an alternative to FormSheet's
 * 600px panel sliding in from the right (Andrea, 2026-09-14: "non mi piace
 * come slide a destra, voglio una popup grande con spazio grande sulla
 * description").
 *
 * The props are deliberately IDENTICAL to FormSheet's, so a page switches by
 * changing the import and the tag — nothing else. FormSheet stays as it is
 * and keeps serving the pages that are happy with it.
 *
 * Sizing: the grid gives the body all the leftover height, so a long
 * description field can grow to fill the modal instead of being squeezed by
 * a 600px column. Header and footer stay put and only the body scrolls, so
 * Save is always reachable — in the sheet it scrolled away below the fields.
 */
export function LargeFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  className,
}: LargeFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Wide, but never wider than the viewport; tall, but never taller,
          // so it stays usable on a laptop screen and on a phone.
          "max-w-[min(1100px,95vw)] w-full h-[min(860px,92vh)]",
          // Rows: header (auto) · body (all the rest) · footer (auto).
          "grid grid-rows-[auto_1fr_auto] gap-0 p-0 overflow-hidden",
          className
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* One form spanning body and footer: the submit button stays pinned
            outside the scroll area while still submitting these fields. */}
        <form
          onSubmit={onSubmit}
          className="contents"
        >
          <div className="overflow-y-auto px-6 py-6 space-y-8">{children}</div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-slate-50/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
