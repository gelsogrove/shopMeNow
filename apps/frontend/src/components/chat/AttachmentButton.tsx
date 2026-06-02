/**
 * AttachmentButton — paperclip icon for the chat composer.
 *
 * Opens a native file picker (multiple, images + PDF), validates the selection
 * client-side, and reports accepted files + any rejection messages. Styled to
 * match the existing shadcn/Tailwind composer (lucide icons, green theme).
 *
 * Drag & drop is handled by the parent composer (it owns the textarea area);
 * this component is the explicit click affordance Andrea asked for.
 */

import { Paperclip } from "lucide-react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { ACCEPTED_ACCEPT_ATTR, validateSelection } from "./attachment-utils"

interface AttachmentButtonProps {
  /** How many files are already staged, to enforce the per-message cap. */
  existingCount: number
  onFilesAccepted: (files: File[]) => void
  onErrors?: (errors: string[]) => void
  disabled?: boolean
  title?: string
}

export function AttachmentButton({
  existingCount,
  onFilesAccepted,
  onErrors,
  disabled = false,
  title = "Attach files",
}: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    // Reset so selecting the same file again re-triggers onChange.
    e.target.value = ""
    if (files.length === 0) return
    const { accepted, errors } = validateSelection(files, existingCount)
    if (accepted.length > 0) onFilesAccepted(accepted)
    if (errors.length > 0) onErrors?.(errors)
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-end h-8 w-8 p-0 text-gray-500 hover:text-green-600"
        onClick={handlePick}
        disabled={disabled}
        title={title}
        aria-label={title}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_ACCEPT_ATTR}
        className="hidden"
        onChange={handleChange}
        data-testid="attachment-file-input"
      />
    </>
  )
}
