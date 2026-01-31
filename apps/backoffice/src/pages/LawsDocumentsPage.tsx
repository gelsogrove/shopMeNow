import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { LegalDocumentEditDialog } from "@/components/legal-documents/LegalDocumentEditDialog"
import { Edit } from "lucide-react"

interface LegalDocument {
  id: string
  type: string
  contentIt: string
  contentEn: string
  contentEs: string
  contentPt: string
  updatedAt: string
}

export function LawsDocumentsPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      
      // Legal documents are GLOBAL to eCHATBOT platform (not workspace-specific)
      // No workspaceId needed - these are the site's legal terms
      const response = await api.get(`/legal-documents`)
      const data = await response.json()
      
      // Ensure data is an array before setting
      if (Array.isArray(data)) {
        setDocuments(data)
      } else {
        console.error("API returned non-array data:", data)
        setDocuments([])
        toast.error("Formato dati non valido dal server")
      }
    } catch (error) {
      toast.error("Error loading legal documents")
      console.error(error)
      setDocuments([]) // Reset to empty array on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (document: LegalDocument) => {
    setSelectedDocument(document)
    setIsEditDialogOpen(true)
  }

  const handleSave = (updatedDocument: LegalDocument) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.type === updatedDocument.type ? updatedDocument : doc))
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documenti Legali eCHATBOT</h1>
        <p className="text-gray-500 mt-2">
          Gestisci i documenti legali del <strong>sito eCHATBOT</strong> (GDPR, Privacy, Termini, Rimborsi).
        </p>
        <p className="text-blue-600 text-sm mt-1 font-medium">
          ⚠️ IMPORTANTE: Questi documenti descrivono i termini della PIATTAFORMA eCHATBOT, non dei workspace dei clienti
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Each document is available in 4 languages and can be edited but not deleted.
        </p>
      </div>

      <div className="grid gap-4">
        {documents.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            Nessun documento trovato. Esegui il seed del database.
          </div>
        )}

        {documents.map((document) => {
          // Get human-readable type label
          const typeLabels: Record<string, string> = {
            GDPR: "GDPR",
            PRIVACY_POLICY: "Privacy Policy",
            TERMS_OF_SERVICE: "Terms of Service",
            REFUND_POLICY: "Refund & Cancellation Policy",
          }

          return (
            <Card key={document.type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{typeLabels[document.type] || document.type}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEdit(document)}
                    variant="outline"
                    disabled={isLoading}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedDocument && (
        <LegalDocumentEditDialog
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          document={selectedDocument}
          onSave={handleSave}
        />
      )}

      {isLoading && <div className="text-center py-8">Caricamento...</div>}
    </div>
  )
}
