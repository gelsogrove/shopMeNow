/**
 * Collections Page - Monthly invoices for manual collection
 *
 * Shows current month invoices per owner with:
 * - Amount due
 * - Status
 * - Done toggle
 * - Admin notes
 */

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { api } from '@/services/api'
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'

interface OwnerInvoiceRow {
  owner: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    companyName: string | null
    planType: string
    subscriptionStatus: string
    creditBalance: number
    paymentFailureCount: number
    lastPaymentFailedAt: string | null
  }
  invoice: {
    id: string
    periodMonth: number
    periodYear: number
    totalAmount: number
    subtotalAmount?: number
    taxAmount?: number
    creditNotesTotal?: number
    status: string
    paidAt: string | null
    adminNotes: string | null
    adminMarkedById: string | null
    adminMarkedAt: string | null
  }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PAID':
      return <Badge className="bg-emerald-600 text-white">PAID</Badge>
    case 'FAILED':
      return <Badge className="bg-red-600 text-white">FAILED</Badge>
    case 'PENDING':
      return <Badge className="bg-amber-500 text-white">PENDING</Badge>
    case 'DRAFT':
      return <Badge className="bg-slate-500 text-white">DRAFT</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export function CollectionsPage() {
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current')
  const [rows, setRows] = useState<OwnerInvoiceRow[]>([])
  const [historyRows, setHistoryRows] = useState<OwnerInvoiceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [notesByInvoice, setNotesByInvoice] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState<string | null>(null)
  const [creditNoteModal, setCreditNoteModal] = useState<{ invoiceId: string } | null>(null)
  const [creditNoteAmount, setCreditNoteAmount] = useState('')
  const [creditNoteReason, setCreditNoteReason] = useState('')
  const [creditNotes, setCreditNotes] = useState<Array<{ id: string; amount: number; reason: string | null; createdAt: string }>>([])
  const [creditNotesLoading, setCreditNotesLoading] = useState(false)
  const [editingCreditNoteId, setEditingCreditNoteId] = useState<string | null>(null)
  const [editingCreditNoteAmount, setEditingCreditNoteAmount] = useState('')
  const [editingCreditNoteReason, setEditingCreditNoteReason] = useState('')
  const [historyMonth, setHistoryMonth] = useState<number | null>(null)
  const [historyYear, setHistoryYear] = useState<number | null>(null)

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    const response = await api.users.getCurrentInvoices()

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to load invoices')
      setIsLoading(false)
      return
    }

    setRows(response.data)
    const initialNotes: Record<string, string> = {}
    response.data.forEach((row) => {
      initialNotes[row.invoice.id] = row.invoice.adminNotes || ''
    })
    setNotesByInvoice(initialNotes)
    setIsLoading(false)
  }

  const loadHistory = async (params?: { month?: number | null; year?: number | null }) => {
    setIsHistoryLoading(true)
    setError(null)

    const response = await api.users.getInvoiceHistory({
      periodMonth: params?.month ?? historyMonth ?? undefined,
      periodYear: params?.year ?? historyYear ?? undefined,
    })

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to load invoice history')
      setIsHistoryLoading(false)
      return
    }

    setHistoryRows(response.data)
    setIsHistoryLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => {
      const name = `${row.owner.firstName || ''} ${row.owner.lastName || ''}`.trim()
      const company = row.owner.companyName || ''
      return (
        row.owner.email.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query) ||
        company.toLowerCase().includes(query)
      )
    })
  }, [rows, searchQuery])

  const filteredHistoryRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return historyRows
    return historyRows.filter((row) => {
      const name = `${row.owner.firstName || ''} ${row.owner.lastName || ''}`.trim()
      const company = row.owner.companyName || ''
      return (
        row.owner.email.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query) ||
        company.toLowerCase().includes(query)
      )
    })
  }, [historyRows, searchQuery])

  const updateInvoice = async (invoiceId: string, status: string) => {
    setUpdating(invoiceId)
    const response = await api.users.updateInvoice(invoiceId, {
      status,
      adminNotes: notesByInvoice[invoiceId] || '',
    })

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to update invoice')
      setUpdating(null)
      return
    }

    setRows((prev) =>
      prev.map((row) =>
        row.invoice.id === invoiceId
          ? {
              ...row,
              invoice: {
                ...row.invoice,
                status: response.data.status,
                adminNotes: response.data.adminNotes,
                adminMarkedById: response.data.adminMarkedById,
                adminMarkedAt: response.data.adminMarkedAt,
                paidAt: response.data.paidAt,
              },
            }
          : row
      )
    )
    setUpdating(null)
  }

  const handleDownloadInvoice = async (invoiceId: string, periodMonth: number, periodYear: number) => {
    try {
      const blob = await api.users.downloadInvoicePdf(invoiceId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${periodYear}-${String(periodMonth).padStart(2, '0')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setError('Failed to download invoice')
    }
  }

  const handleCreateCreditNote = async (invoiceId: string) => {
    const amount = Number(creditNoteAmount)
    if (!amount || amount <= 0) {
      setError('Credit note amount must be greater than 0')
      return
    }

    setUpdating(invoiceId)
    const response = await api.users.createCreditNote(invoiceId, {
      amount,
      reason: creditNoteReason || undefined,
    })

    if (!response.success) {
      setError(response.error || 'Failed to create credit note')
      setUpdating(null)
      return
    }

    setCreditNoteAmount('')
    setCreditNoteReason('')
    await loadCreditNotes(invoiceId)
    await loadData()
    await loadHistory()
    setUpdating(null)
  }

  const loadCreditNotes = async (invoiceId: string) => {
    setCreditNotesLoading(true)
    const response = await api.users.getCreditNotes(invoiceId)

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to load credit notes')
      setCreditNotesLoading(false)
      return
    }

    setCreditNotes(response.data)
    setCreditNotesLoading(false)
  }

  const startEditCreditNote = (note: { id: string; amount: number; reason: string | null }) => {
    setEditingCreditNoteId(note.id)
    setEditingCreditNoteAmount(String(note.amount))
    setEditingCreditNoteReason(note.reason || '')
  }

  const handleUpdateCreditNote = async (invoiceId: string, noteId: string) => {
    const amount = Number(editingCreditNoteAmount)
    if (!amount || amount <= 0) {
      setError('Credit note amount must be greater than 0')
      return
    }

    setUpdating(noteId)
    const response = await api.users.updateCreditNote(invoiceId, noteId, {
      amount,
      reason: editingCreditNoteReason || undefined,
    })

    if (!response.success) {
      setError(response.error || 'Failed to update credit note')
      setUpdating(null)
      return
    }

    setEditingCreditNoteId(null)
    setEditingCreditNoteAmount('')
    setEditingCreditNoteReason('')
    await loadCreditNotes(invoiceId)
    await loadData()
    await loadHistory()
    setUpdating(null)
  }

  const handleDeleteCreditNote = async (invoiceId: string, noteId: string) => {
    setUpdating(noteId)
    const response = await api.users.deleteCreditNote(invoiceId, noteId)

    if (!response.success) {
      setError(response.error || 'Failed to delete credit note')
      setUpdating(null)
      return
    }

    await loadCreditNotes(invoiceId)
    await loadData()
    await loadHistory()
    setUpdating(null)
  }

  const handleRecordPaymentFailure = async (ownerId: string, invoiceId: string) => {
    setUpdating(invoiceId)
    const response = await api.users.recordPaymentFailure(
      ownerId,
      notesByInvoice[invoiceId] || undefined
    )

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to record payment failure')
      setUpdating(null)
      return
    }

    setRows((prev) =>
      prev.map((row) =>
        row.owner.id === ownerId
          ? {
              ...row,
              owner: {
                ...row.owner,
                subscriptionStatus: response.data.subscriptionStatus,
                paymentFailureCount: response.data.paymentFailureCount,
                lastPaymentFailedAt: response.data.lastPaymentFailedAt,
              },
            }
          : row
      )
    )
    setUpdating(null)
  }

  const handleResetPaymentFailure = async (ownerId: string, invoiceId: string) => {
    setUpdating(invoiceId)
    const response = await api.users.resetPaymentFailure(
      ownerId,
      notesByInvoice[invoiceId] || undefined
    )

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to reset payment failure')
      setUpdating(null)
      return
    }

    setRows((prev) =>
      prev.map((row) =>
        row.owner.id === ownerId
          ? {
              ...row,
              owner: {
                ...row.owner,
                subscriptionStatus: response.data.subscriptionStatus,
                paymentFailureCount: response.data.paymentFailureCount,
                lastPaymentFailedAt: null,
              },
            }
          : row
      )
    )
    setUpdating(null)
  }

  const handleMockPayment = async (invoiceId: string) => {
    setUpdating(invoiceId)
    const response = await api.users.mockPayPalPayment(
      invoiceId,
      notesByInvoice[invoiceId] || undefined
    )

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to process payment')
      setUpdating(null)
      return
    }

    await loadData()
    await loadHistory()
    setUpdating(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Monthly Collections</h1>
          <p className="text-sm text-gray-600">
            Review invoices, mark payments, and manage credit notes.
          </p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={viewMode === 'current' ? 'default' : 'outline'}
          onClick={() => setViewMode('current')}
        >
          Current Month
        </Button>
        <Button
          variant={viewMode === 'history' ? 'default' : 'outline'}
          onClick={() => {
            setViewMode('history')
            loadHistory()
          }}
        >
          History
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {viewMode === 'history' && (
              <>
                <select
                  className="border rounded-md px-3 py-2 text-sm"
                  value={historyMonth ?? ''}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null
                    setHistoryMonth(value)
                    loadHistory({ month: value, year: historyYear })
                  }}
                >
                  <option value="">All months</option>
                  {Array.from({ length: 12 }).map((_, index) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() - index)
                    const label = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
                    return (
                      <option key={label} value={date.getMonth() + 1}>
                        {label}
                      </option>
                    )
                  })}
                </select>
                <select
                  className="border rounded-md px-3 py-2 text-sm"
                  value={historyYear ?? ''}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null
                    setHistoryYear(value)
                    loadHistory({ month: historyMonth, year: value })
                  }}
                >
                  <option value="">All years</option>
                  {Array.from({ length: 5 }).map((_, index) => {
                    const year = new Date().getFullYear() - index
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  })}
                </select>
              </>
            )}
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            Actions: Download = invoice PDF. Process Payment = mock monthly payment (random success). Record Failure = log failed attempt (no block). Mark Paid/Failed = invoice status. Reset Payment = clear failure count.
          </div>

          <div className="grid gap-4">
            {viewMode === 'history' && isHistoryLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                Loading history...
              </div>
            ) : (
              (viewMode === 'history' ? filteredHistoryRows : filteredRows).map((row) => {
              const ownerName = `${row.owner.firstName || ''} ${row.owner.lastName || ''}`.trim()
              const invoice = row.invoice
              const isUpdatingRow = updating === invoice.id
              const paymentFailureCount = row.owner.paymentFailureCount || 0
              const lastFailure = row.owner.lastPaymentFailedAt
                ? new Date(row.owner.lastPaymentFailedAt).toLocaleDateString('it-IT')
                : '—'

              return (
                <div
                  key={invoice.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          {row.owner.email}
                        </span>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {ownerName || '—'} · {row.owner.companyName || '—'} · {row.owner.planType}
                      </div>
                      <div className="text-xs text-gray-500">
                        Period: {invoice.periodMonth}/{invoice.periodYear} · Balance: {formatCurrency(row.owner.creditBalance)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Payment failures: {paymentFailureCount} · Last: {lastFailure}
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-sm text-gray-500">Amount due</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </div>
                      {invoice.creditNotesTotal && invoice.creditNotesTotal > 0 && (
                        <div className="text-xs text-emerald-600">
                          Credit notes: -{formatCurrency(invoice.creditNotesTotal)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] md:items-center">
                    <Input
                      placeholder="Admin notes..."
                      value={notesByInvoice[invoice.id] || ''}
                      onChange={(e) =>
                        setNotesByInvoice((prev) => ({
                          ...prev,
                          [invoice.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleDownloadInvoice(invoice.id, invoice.periodMonth, invoice.periodYear)}
                      disabled={isUpdatingRow}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRecordPaymentFailure(row.owner.id, invoice.id)}
                      disabled={isUpdatingRow}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Record Failure
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setCreditNoteModal({ invoiceId: invoice.id })
                        await loadCreditNotes(invoice.id)
                      }}
                      disabled={isUpdatingRow}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Credit Notes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleMockPayment(invoice.id)}
                      disabled={isUpdatingRow}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Process Payment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateInvoice(invoice.id, 'PAID')}
                      disabled={isUpdatingRow}
                    >
                      {isUpdatingRow ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Paid
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => updateInvoice(invoice.id, 'FAILED')}
                      disabled={isUpdatingRow}
                    >
                      {isUpdatingRow ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Mark Failed
                        </>
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleResetPaymentFailure(row.owner.id, invoice.id)}
                      disabled={isUpdatingRow || paymentFailureCount === 0}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Reset Payment
                    </Button>
                  </div>
                </div>
              )
            })
            )}

            {(viewMode === 'history' ? filteredHistoryRows : filteredRows).length === 0 && !isHistoryLoading && (
              <div className="text-center text-sm text-gray-500 py-8">
                No invoices found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!creditNoteModal}
        onOpenChange={(open) => {
          if (!open) {
            setCreditNoteModal(null)
            setCreditNoteAmount('')
            setCreditNoteReason('')
            setCreditNotes([])
            setEditingCreditNoteId(null)
            setEditingCreditNoteAmount('')
            setEditingCreditNoteReason('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Credit notes</DialogTitle>
            <DialogDescription>Manage credit notes for this invoice.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="creditNoteAmount">New credit note amount</Label>
              <Input
                id="creditNoteAmount"
                type="number"
                min="0"
                step="0.01"
                value={creditNoteAmount}
                onChange={(e) => setCreditNoteAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditNoteReason">Reason</Label>
              <Input
                id="creditNoteReason"
                placeholder="Optional reason"
                value={creditNoteReason}
                onChange={(e) => setCreditNoteReason(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Existing credit notes</Label>
            {creditNotesLoading ? (
              <div className="text-sm text-gray-500">Loading credit notes...</div>
            ) : creditNotes.length === 0 ? (
              <div className="text-sm text-gray-500">No credit notes yet.</div>
            ) : (
              creditNotes.map((note) => (
                <div key={note.id} className="rounded border border-gray-200 p-3">
                  {editingCreditNoteId === note.id ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingCreditNoteAmount}
                        onChange={(e) => setEditingCreditNoteAmount(e.target.value)}
                      />
                      <Input
                        type="text"
                        placeholder="Reason"
                        value={editingCreditNoteReason}
                        onChange={(e) => setEditingCreditNoteReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            creditNoteModal &&
                            handleUpdateCreditNote(creditNoteModal.invoiceId, note.id)
                          }
                          disabled={!!updating}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCreditNoteId(null)
                            setEditingCreditNoteAmount('')
                            setEditingCreditNoteReason('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">€{note.amount.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">{note.reason || 'No reason'}</div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => startEditCreditNote(note)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            creditNoteModal &&
                            handleDeleteCreditNote(creditNoteModal.invoiceId, note.id)
                          }
                          disabled={!!updating}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreditNoteModal(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => creditNoteModal && handleCreateCreditNote(creditNoteModal.invoiceId)}
              disabled={!!updating || !creditNoteModal}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
