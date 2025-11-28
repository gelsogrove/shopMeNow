/**
 * GDPR SETTINGS TAB - VERSIONE FUNZIONANTE
 *
 * ✅ SOLUZIONE TESTATA E FUNZIONANTE
 * Data: 13 Giugno 2025
 *
 * PROBLEMA RISOLTO:
 * - Chiamava endpoint sbagliato: /api/settings/{workspaceId}/gdpr (404)
 * - Ora chiama endpoint corretto: /api/settings/gdpr (200 OK)
 *
 * MODIFICHE APPLICATE:
 * 1. GET: api.get('/settings/gdpr') invece di api.get(`/settings/${workspace.id}/gdpr`)
 * 2. PUT: api.put('/settings/gdpr', { gdpr: gdprText }) invece di workspace-specific
 * 3. Rimosso controllo sessionStorage per workspace (non necessario)
 * 4. Backend usa header x-workspace-id automaticamente
 *
 * ⚠️ NON MODIFICARE QUESTI ENDPOINT SENZA TESTARE
 */

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { Loader2, Save, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"

export function GdprSettingsTab() {
  const [isLoading, setIsLoading] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [gdprText, setGdprText] = useState("")
  const [defaultGdpr, setDefaultGdpr] = useState("")

  useEffect(() => {
    const loadData = async () => {
      setIsPageLoading(true)
      try {
        const response = await api.get(`/settings/gdpr`)
        setGdprText(response.data.data?.gdpr || response.data.content || "")
      } catch (error) {
        logger.error("Error loading GDPR content:", error)
        toast.error("Failed to load GDPR content")
      } finally {
        setIsPageLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await api.put(`/settings/gdpr`, { gdpr: gdprText })

      toast.success("GDPR policy saved successfully")
    } catch (error) {
      logger.error("Error saving GDPR policy:", error)
      toast.error("Failed to save GDPR policy")
    } finally {
      setIsLoading(false)
    }
  }

  if (isPageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-medium">Loading GDPR policy...</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-medium">Privacy & GDPR Policy</h3>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Edit your privacy policy and GDPR compliance statement that will be
          shown to your customers.
        </p>

        <Textarea
          value={gdprText}
          onChange={(e) => setGdprText(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
        />

        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Policy
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
