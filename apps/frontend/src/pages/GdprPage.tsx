import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"
import { gdprApi, GdprContent } from "@/services/gdprApi"
import { Loader2, Save } from "lucide-react"
import { useWorkspace } from "@/hooks/use-workspace"

interface LanguageConfig {
  key: keyof GdprContent
  label: string
  flag: string
}

const LANGUAGES: LanguageConfig[] = [
  { key: "gdpr_ita", label: "Italiano", flag: "🇮🇹" },
  { key: "gdpr_eng", label: "English", flag: "🇬🇧" },
  { key: "gdpr_esp", label: "Español", flag: "🇪🇸" },
  { key: "gdpr_prt", label: "Português", flag: "🇵🇹" },
]

export default function GdprPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [gdprContent, setGdprContent] = useState<GdprContent>({
    gdpr_ita: "",
    gdpr_eng: "",
    gdpr_esp: "",
    gdpr_prt: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoadingWorkspace && workspace?.id) {
      loadGdprContent()
    }
  }, [workspace?.id, isLoadingWorkspace])

  const loadGdprContent = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!workspace?.id) {
        setError("Workspace not found")
        return
      }

      const content = await gdprApi.getContent(workspace.id)
      if (content) {
        setGdprContent(content)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load GDPR content"
      setError(errorMessage)
      toast.error("Failed to load GDPR content")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTextChange = (key: keyof GdprContent, value: string) => {
    setGdprContent((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      if (!workspace?.id) {
        toast.error("Workspace not found")
        return
      }

      await gdprApi.updateContent(workspace.id, gdprContent)
      toast.success("✅ GDPR content saved!")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save GDPR content"
      toast.error(`❌ ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingWorkspace || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
          <Button onClick={loadGdprContent} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">GDPR Content Manager</h1>
        <p className="text-gray-600 mt-2">Edit GDPR privacy notice in 4 languages</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LANGUAGES.map((lang) => (
          <Card key={lang.key}>
            <CardHeader>
              <CardTitle className="text-lg">
                {lang.flag} {lang.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Textarea
                  value={gdprContent[lang.key]}
                  onChange={(e) => handleTextChange(lang.key, e.target.value)}
                  placeholder={`Enter GDPR content for ${lang.label}...`}
                  className="min-h-[300px] font-mono text-sm"
                />
                <div className="text-xs text-gray-500">
                  {gdprContent[lang.key].length} characters
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save All Languages
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
