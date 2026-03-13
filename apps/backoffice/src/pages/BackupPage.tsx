import { useState } from "react"
import { api } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Shield, Download, AlertTriangle, CheckCircle2 } from "lucide-react"

export function BackupPage() {
  const [status, setStatus] = useState<"idle" | "running" | "error" | "done">("idle")
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setStatus("running")
    setError(null)
    try {
      const response = await api.adminBackup.download()
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Request failed with ${response.status}`)
      }
      const blob = await response.blob()
      const disposition = response.headers.get("content-disposition")
      const suggested =
        disposition?.match(/filename=\"?([^\";]+)\"?/)?.[1] || "backup.sql"
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = suggested
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setStatus("done")
    } catch (err: any) {
      setStatus("error")
      setError(err?.message || "Download failed")
    }
  }

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>Backup on demand</CardTitle>
            <CardDescription>
              Genera e scarica un dump del database in streaming (nessun file salvato sul server).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning" className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Dato sensibile</AlertTitle>
            <AlertDescription>
              Il file può contenere dati personali. Conservalo in modo sicuro e non condividerlo.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleDownload}
              disabled={status === "running"}
              className="inline-flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {status === "running" ? "Generazione in corso..." : "Scarica backup ora"}
            </Button>
            {status === "done" && (
              <div className="inline-flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Scaricato
              </div>
            )}
            {status === "error" && (
              <div className="text-sm text-red-600">
                {error || "Errore durante il download"}
              </div>
            )}
          </div>

          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Accesso riservato ai Platform Admin (autenticazione backoffice).</li>
            <li>Il dump è generato al volo con <code>pg_dump</code> e mai scritto su disco server.</li>
            <li>Connessione HTTPS raccomandata per scaricare in sicurezza.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
