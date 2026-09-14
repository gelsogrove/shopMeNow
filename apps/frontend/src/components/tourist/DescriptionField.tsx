import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/shared/RichTextEditor"
import { useState } from "react"

interface DescriptionFieldProps {
  defaultValue?: string | null
  label?: string
  /** Taller than the shared editor's default: this is the field Andrea wanted room for. */
  minHeight?: string
}

/**
 * The description field, edited in a WYSIWYG (Andrea, 2026-09-14: "voglio una
 * popup grande con spazio grande sulla description, magari metti un lettore di
 * bold corsivo colori un WYSIWYG").
 *
 * WHY THE HIDDEN INPUT
 * The tourist forms are uncracked HTML forms: the page reads the values with
 * `new FormData(e.currentTarget)` on submit, by field NAME. Quill is a
 * controlled React component and puts nothing in the form. So the editor holds
 * the state and mirrors it into a hidden input named "description" — the
 * submit handlers keep working untouched, and no page had to learn about the
 * editor.
 *
 * The stored value is HTML. It is stripped back to plain text server-side
 * before it reaches the chatbot prompt (`plainText` in
 * custom-client-chatbot.service.ts): WhatsApp renders no tags, and every tag
 * would be an input token paid on every turn.
 */
export function DescriptionField({
  defaultValue,
  label = "Description",
  minHeight = "260px",
}: DescriptionFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "")

  return (
    <div className="space-y-2">
      <Label htmlFor="description">{label}</Label>
      <RichTextEditor value={value} onChange={setValue} minHeight={minHeight} />
      <input type="hidden" name="description" value={value} />
    </div>
  )
}
