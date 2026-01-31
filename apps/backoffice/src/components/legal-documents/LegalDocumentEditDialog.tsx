import { useState, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"

interface LegalDocumentEditDialogProps {
  isOpen: boolean
  onClose: () => void
  document: any
  onSave: (document: any) => void
}

const LANGUAGES = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
]

export function LegalDocumentEditDialog({
  isOpen,
  onClose,
  document,
  onSave,
}: LegalDocumentEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState(document || {})

  // Reset formData when document changes (fixes bug where all documents show same content)
  useEffect(() => {
    if (document) {
      setFormData(document)
    }
  }, [document])

  const handleFieldChange = (language: string, field: "title" | "content", value: string) => {
    // Generate correct field name: titleIt, titleEn, contentIt, contentEn (not contentIT, titleIT)
    const langCapitalized = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase()
    const key = `${field}${langCapitalized}`
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true)

      // Legal documents are GLOBAL to eCHATBOT platform (no workspace)
      await api.put(`/legal-documents/${document.type}`, formData)

      toast.success("Document saved successfully")
      onSave(formData)
      onClose()
    } catch (error) {
      toast.error("Error saving document")
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }, [formData, document.type, onSave, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit: {document?.type?.replace(/_/g, " ")}</DialogTitle>
          <DialogDescription>
            Edit content in all supported languages. You cannot delete this document.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="it" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {LANGUAGES.map((lang) => (
              <TabsTrigger key={lang.code} value={lang.code}>
                {lang.flag} {lang.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {LANGUAGES.map((lang) => (
            <TabsContent key={lang.code} value={lang.code} className="space-y-4">
              <div>
                <Label htmlFor={`title-${lang.code}`} className="text-sm font-medium">
                  Titolo ({lang.label})
                </Label>
                <Input
                  id={`title-${lang.code}`}
                  value={formData[`title${lang.code.charAt(0).toUpperCase() + lang.code.slice(1).toLowerCase()}`] || ""}
                  onChange={(e) => handleFieldChange(lang.code, "title", e.target.value)}
                  placeholder={`Titolo in ${lang.label}`}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor={`content-${lang.code}`} className="text-sm font-medium">
                  Contenuto HTML ({lang.label})
                </Label>
                <Textarea
                  id={`content-${lang.code}`}
                  value={formData[`content${lang.code.charAt(0).toUpperCase() + lang.code.slice(1).toLowerCase()}`] || ""}
                  onChange={(e) => handleFieldChange(lang.code, "content", e.target.value)}
                  placeholder={`Contenuto HTML in ${lang.label}`}
                  className="mt-1 font-mono text-sm h-80"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Supporta HTML: &lt;h1&gt;, &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;
                </p>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
