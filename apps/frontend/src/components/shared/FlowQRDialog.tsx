/**
 * FlowQRDialog — Generate + download QR code for FLOW entry points.
 *
 * QR payload format: `START_FLOW_{machineNumber}_{flowKey}`
 * When a customer scans it, `FlowWorkspaceStrategy` extracts the flowKey,
 * loads the matching `FlowNodeConfig`, and welcomes the customer.
 */
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, QrCode } from "lucide-react"
import QRCode from "qrcode"
import { useEffect, useMemo, useRef, useState } from "react"

interface FlowQRDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flowKey: string
  flowLabel: string
  widgetUrl?: string
}

export function FlowQRDialog({
  open,
  onOpenChange,
  flowKey,
  flowLabel,
  widgetUrl,
}: FlowQRDialogProps) {
  const [machineNumber, setMachineNumber] = useState<string>("1")
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const payload = useMemo(() => {
    const n = machineNumber.trim() || "1"
    // If the admin provided a widget URL, embed the payload as a query string
    // so scanning the QR with a camera opens the chat directly. Otherwise the
    // raw payload is sufficient for a WhatsApp pre-filled message scenario.
    const raw = `START_FLOW_${n}_${flowKey}`
    if (widgetUrl) {
      const sep = widgetUrl.includes("?") ? "&" : "?"
      return `${widgetUrl}${sep}flow=${encodeURIComponent(raw)}`
    }
    return raw
  }, [machineNumber, flowKey, widgetUrl])

  useEffect(() => {
    if (!open || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
    }).catch(() => {
      // ignore render errors — user will see empty canvas
    })
  }, [open, payload])

  const handleDownload = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(payload, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "M",
      })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `flow-${flowKey}-${machineNumber || "1"}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      // noop
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generate QR Code
          </DialogTitle>
          <DialogDescription>
            Print this QR on the physical machine. When scanned, it starts the{" "}
            <span className="font-semibold">{flowLabel}</span> flow for the
            selected machine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="machineNumber">Machine Number</Label>
            <Input
              id="machineNumber"
              type="number"
              min={1}
              value={machineNumber}
              onChange={(e) => setMachineNumber(e.target.value)}
              placeholder="1"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for this physical machine (e.g. 1, 2, 3…).
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-md border bg-white p-4">
            <canvas ref={canvasRef} />
            <code className="text-xs text-muted-foreground break-all text-center">
              {payload}
            </code>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
