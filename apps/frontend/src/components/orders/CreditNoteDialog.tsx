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
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { toast } from "@/lib/toast"
import { creditNotesApi, type CreditNote } from "@/services/creditNotesApi"
import type { Order } from "@/services/ordersApi"
import { formatPrice } from "@/utils/format"
import { Loader2, Receipt, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

interface CreditNoteDialogProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (creditNote?: CreditNote) => void
}

export function CreditNoteDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: CreditNoteDialogProps) {
  const { workspace } = useWorkspace()
  const [amount, setAmount] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [existingCreditNotes, setExistingCreditNotes] = useState<CreditNote[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  // Calculate remaining amount that can be credited
  const existingTotal = existingCreditNotes.reduce((sum, cn) => sum + cn.amount, 0)
  const maxAmount = order ? order.totalAmount - existingTotal : 0

  // Load existing credit notes when dialog opens
  const loadCreditNotes = async () => {
    if (!order || !workspace?.id) return
    setLoadingExisting(true)
    try {
      const notes = await creditNotesApi.getByOrderId(workspace.id, order.id)
      setExistingCreditNotes(notes)
    } catch (error) {
      console.error("Error loading credit notes:", error)
    } finally {
      setLoadingExisting(false)
    }
  }

  useEffect(() => {
    if (open && order && workspace?.id) {
      loadCreditNotes()
    } else {
      // Reset when closed
      setExistingCreditNotes([])
      setAmount("")
      setReason("")
    }
  }, [open, order, workspace?.id])

  const handleDelete = async (creditNote: CreditNote) => {
    if (!workspace?.id) return

    if (!confirm(`Sei sicuro di voler eliminare la nota ${creditNote.creditNoteCode}?`)) {
      return
    }

    setDeletingId(creditNote.id)
    try {
      await creditNotesApi.delete(workspace.id, creditNote.id)
      toast.success(`Nota ${creditNote.creditNoteCode} eliminata`)
      // Reload credit notes
      await loadCreditNotes()
      onSuccess?.()
    } catch (error: any) {
      const message = error.response?.data?.message || "Errore nell'eliminazione"
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async () => {
    if (!order || !workspace?.id) return

    const parsedAmount = parseFloat(amount)

    // Validation
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("L'importo deve essere un numero maggiore di zero")
      return
    }

    if (parsedAmount > maxAmount) {
      toast.error(
        `L'importo supera il valore residuo dell'ordine. Massimo: €${maxAmount.toFixed(2)}`
      )
      return
    }

    if (!reason.trim()) {
      toast.error("Il motivo della nota di credito è obbligatorio")
      return
    }

    setIsLoading(true)
    try {
      const creditNote = await creditNotesApi.create(workspace.id, order.id, {
        amount: parsedAmount,
        reason: reason.trim(),
      })

      toast.success(
        `Nota di credito ${creditNote.creditNoteCode} creata con successo`
      )
      onOpenChange(false)
      onSuccess?.(creditNote)
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        "Errore nella creazione della nota di credito"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if order is CONFIRMED or DELIVERED
  const canCreateCreditNote = order?.status === "DELIVERED" || order?.status === "CONFIRMED"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Nota di Credito
          </DialogTitle>
          <DialogDescription>
            Crea una nota di credito per l'ordine{" "}
            <strong>{order?.orderCode}</strong>
          </DialogDescription>
        </DialogHeader>

        {!canCreateCreditNote ? (
          <div className="py-4">
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
              <p className="text-sm text-yellow-800">
                Le note di credito possono essere emesse solo per ordini con
                stato <strong>CONFIRMED</strong> o <strong>DELIVERED</strong>.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Stato attuale: <strong>{order?.status}</strong>
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Order Summary */}
            <div className="rounded-md bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{order?.customer?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Totale ordine:</span>
                <span className="font-medium">
                  {formatPrice(order?.totalAmount || 0, workspace?.currency)}
                </span>
              </div>
              {loadingExisting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Caricamento note esistenti...
                </div>
              ) : existingCreditNotes.length > 0 ? (
                <>
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Note di credito esistenti:</span>
                    <span className="font-medium">
                      -{formatPrice(existingTotal, workspace?.currency)}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm font-medium">
                    <span>Importo residuo:</span>
                    <span>
                      {formatPrice(maxAmount, workspace?.currency)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Existing Credit Notes List */}
            {existingCreditNotes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Note di credito già emesse:
                </Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {existingCreditNotes.map((cn) => (
                    <div
                      key={cn.id}
                      className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5 group"
                    >
                      <span className="font-mono">{cn.creditNoteCode}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-600">
                          -{formatPrice(cn.amount, workspace?.currency)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-opacity"
                          onClick={() => handleDelete(cn)}
                          disabled={deletingId === cn.id}
                          title="Elimina nota di credito"
                        >
                          {deletingId === cn.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Importo (€)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxAmount}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={maxAmount <= 0}
                />
                {maxAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Importo massimo: €{maxAmount.toFixed(2)}
                  </p>
                )}
                {maxAmount <= 0 && (
                  <p className="text-xs text-red-500">
                    L'intero importo dell'ordine è già stato rimborsato.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo</Label>
                <Textarea
                  id="reason"
                  placeholder="Inserisci il motivo della nota di credito..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  disabled={maxAmount <= 0}
                />
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          {canCreateCreditNote && (
            <Button
              onClick={handleSubmit}
              disabled={isLoading || maxAmount <= 0}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea Nota di Credito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
