/**
 * Collections Page - Monthly invoices for manual collection
 *
 * Shows current month invoices per owner with:
 * - Amount due
 * - Status
 * - Done toggle
 * - Admin notes
 */

import { useCallback, useEffect, useState } from 'react'
import { roundMoney } from '@/utils/money'
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
  Trash2,
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
    invoiceNumber?: string | null
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
    creditNotes?: Array<{ id: string; amount: number; reason: string | null; createdAt: string }>
  }
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const formatUsd = (value: number) => usdFormatter.format(roundMoney(value))

const formatMonthYear = (month: number, year: number) => {
  const normalizedMonth = ((month + 11) % 12) + 1
  const normalizedYear = year + Math.floor((month - 1) / 12)
  return `${String(normalizedMonth).padStart(2, '0')}/${normalizedYear}`
}

const getPreviousMonthFromDate = (date: Date) => {
  const cursor = new Date(date.getFullYear(), date.getMonth(), 1)
  cursor.setMonth(cursor.getMonth() - 1)
  return { month: cursor.getMonth() + 1, year: cursor.getFullYear() }
}

const getPeriodRange = (month: number, year: number) => {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { start, end }
}

const formatDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`

interface InvoicePreviewData {
  id: string
  periodMonth: number
  periodYear: number
  status: string
  planType: string
  subscriptionAmount: number
  creditUsage: number
  rechargesTotal: number
  creditDebt: number
  adjustmentsTotal: number
  creditNotesTotal: number
  subtotalAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  adminNotes?: string | null
  paidAt?: string | null
}

type InvoicePreviewState = {
  loading: boolean
  data?: InvoicePreviewData
  error?: string
}

const mapToInvoicePreview = (payload: any): InvoicePreviewData => ({
  id: payload.id,
  periodMonth: payload.periodMonth,
  periodYear: payload.periodYear,
  status: payload.status,
  planType: payload.planType,
  subscriptionAmount: Number(payload.subscriptionAmount ?? payload.totalAmount ?? 0),
  creditUsage: Number(payload.creditUsage ?? 0),
  rechargesTotal: Number(payload.rechargesTotal ?? 0),
  creditDebt: Number(payload.creditDebt ?? 0),
  adjustmentsTotal: Number(payload.adjustmentsTotal ?? 0),
  creditNotesTotal: Number(payload.creditNotesTotal ?? 0),
  subtotalAmount: Number(payload.subtotalAmount ?? 0),
  taxRate: Number(payload.taxRate ?? 0),
  taxAmount: Number(payload.taxAmount ?? 0),
  totalAmount: Number(payload.totalAmount ?? 0),
  adminNotes: payload.adminNotes ?? null,
  paidAt: payload.paidAt ?? null,
})

const getStatusBadge = (status: string) => {
  if (!status) return null
  const normalizedStatus = status.toUpperCase()
  if (normalizedStatus === 'DRAFT') return null
  switch (normalizedStatus) {
    case 'PAID':
      return <Badge className="bg-emerald-600 text-white">PAID</Badge>
    case 'FAILED':
      return <Badge className="bg-red-600 text-white">FAILED</Badge>
    case 'PENDING':
      return <Badge className="bg-amber-500 text-white">PENDING</Badge>
    default:
      return <Badge variant="secondary">{normalizedStatus}</Badge>
  }
}

const renderPaymentToggle = (status: string) => {
  const isPaid = status === 'PAID'
  const isFailed = status === 'FAILED'

  return (
    <div className="inline-flex overflow-hidden rounded-full border border-gray-200 text-[11px] font-medium">
      <span
        className={`px-2 py-1 ${isPaid ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500'}`}
      >
        PAID
      </span>
      <span
        className={`px-2 py-1 ${isFailed ? 'bg-red-600 text-white' : 'bg-white text-gray-500'}`}
      >
        FAILS
      </span>
    </div>
  )
}

export function CollectionsPage() {
  const [viewMode, setViewMode] = useState<'current' | 'previous' | 'history' | 'failed'>('current')
  const [currentRows, setCurrentRows] = useState<OwnerInvoiceRow[]>([])
  const [previousRows, setPreviousRows] = useState<OwnerInvoiceRow[]>([])
  const [failedRows, setFailedRows] = useState<OwnerInvoiceRow[]>([])
  const [historyRows, setHistoryRows] = useState<OwnerInvoiceRow[]>([])
  const [isCurrentLoading, setIsCurrentLoading] = useState(true)
  const [isPreviousLoading, setIsPreviousLoading] = useState(true)
  const [isFailedLoading, setIsFailedLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notesByInvoice, setNotesByInvoice] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState<string | null>(null)
  const [invoicePreviews, setInvoicePreviews] = useState<Record<string, InvoicePreviewState>>({})
  const [creditNoteModal, setCreditNoteModal] = useState<{ invoiceId: string } | null>(null)
  const [creditNoteAmount, setCreditNoteAmount] = useState('')
  const [creditNoteReason, setCreditNoteReason] = useState('')
  const [creditNotes, setCreditNotes] = useState<Array<{ id: string; amount: number; reason: string | null; createdAt: string }>>([])
  const [creditNotesLoading, setCreditNotesLoading] = useState(false)
  const [editingCreditNoteId, setEditingCreditNoteId] = useState<string | null>(null)
  const [editingCreditNoteAmount, setEditingCreditNoteAmount] = useState('')
  const [editingCreditNoteReason, setEditingCreditNoteReason] = useState('')
  const [adjustmentModal, setAdjustmentModal] = useState<{ invoiceId: string } | null>(null)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjustments, setAdjustments] = useState<
    Array<{ id: string; amount: number; reason: string | null; createdAt: string }>
  >([])
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false)
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null)
  const [editingAdjustmentAmount, setEditingAdjustmentAmount] = useState('')
  const [editingAdjustmentReason, setEditingAdjustmentReason] = useState('')
  const previousDefaults = getPreviousMonthFromDate(new Date())
  const [historyMonth, setHistoryMonth] = useState<number | null>(previousDefaults.month)
  const [historyYear, setHistoryYear] = useState<number | null>(previousDefaults.year)

  const applyNotesFromRows = (rows: OwnerInvoiceRow[]) => {
    setNotesByInvoice((prev) => {
      const next = { ...prev }
      rows.forEach((row) => {
        next[row.invoice.id] = row.invoice.adminNotes || ''
      })
      return next
    })
  }

  const shouldIgnoreError = (message?: string | null) => {
    if (!message) return false
    return message.toLowerCase().includes('invoice not found')
  }

  const loadCurrentInvoices = async () => {
    setIsCurrentLoading(true)
    setError(null)
    const response = await api.users.getCurrentInvoices()

    if (!response.success || !response.data) {
      if (!shouldIgnoreError(response.error)) {
        setError(response.error || 'Failed to load invoices')
      }
      setIsCurrentLoading(false)
      return
    }

    setCurrentRows(response.data)
    applyNotesFromRows(response.data)
    setIsCurrentLoading(false)
  }

  const loadPreviousInvoices = async () => {
    setIsPreviousLoading(true)
    setError(null)
    const response = await api.users.getUnpaidInvoices()

    if (!response.success || !response.data) {
      if (!shouldIgnoreError(response.error)) {
        setError(response.error || 'Failed to load previous invoices')
      }
      setIsPreviousLoading(false)
      return
    }

    setPreviousRows(response.data)
    applyNotesFromRows(response.data)
    setIsPreviousLoading(false)
  }

  const loadFailedInvoices = async () => {
    setIsFailedLoading(true)
    setError(null)
    const response = await api.users.getFailedInvoices()

    if (!response.success || !response.data) {
      if (!shouldIgnoreError(response.error)) {
        setError(response.error || 'Failed to load failed invoices')
      }
      setIsFailedLoading(false)
      return
    }

    setFailedRows(response.data)
    applyNotesFromRows(response.data)
    setIsFailedLoading(false)
  }

  const loadHistory = async (params?: { month?: number | null; year?: number | null }) => {
    setIsHistoryLoading(true)
    setError(null)

    const response = await api.users.getInvoiceHistory({
      periodMonth: params?.month ?? historyMonth ?? undefined,
      periodYear: params?.year ?? historyYear ?? undefined,
    })

    if (!response.success || !response.data) {
      if (!shouldIgnoreError(response.error)) {
        setError(response.error || 'Failed to load invoice history')
      }
      setIsHistoryLoading(false)
      return
    }

    const paidHistory = response.data.filter((row) => row.invoice.status === 'PAID')
    setHistoryRows(paidHistory)
    setIsHistoryLoading(false)
  }

  const loadInvoicePreview = useCallback(async (invoiceId: string) => {
    setInvoicePreviews((prev) => ({
      ...prev,
      [invoiceId]: { ...(prev[invoiceId] || {}), loading: true },
    }))

    const response = await api.users.getInvoiceDetails(invoiceId)

    if (!response.success || !response.data) {
      setInvoicePreviews((prev) => ({
        ...prev,
        [invoiceId]: {
          ...(prev[invoiceId] || {}),
          loading: false,
          error: response.error || 'Failed to load invoice preview',
        },
      }))
      return
    }

    const detail = mapToInvoicePreview(response.data)
    setInvoicePreviews((prev) => ({
      ...prev,
      [invoiceId]: {
        loading: false,
        data: detail,
        error: undefined,
      },
    }))
  }, [])


  useEffect(() => {
    loadCurrentInvoices()
    loadPreviousInvoices()
    loadFailedInvoices()
  }, [])

  useEffect(() => {
    const sourceRows =
      viewMode === 'current'
        ? currentRows
        : viewMode === 'failed'
        ? failedRows
        : viewMode === 'history'
        ? historyRows
        : previousRows
    sourceRows.forEach((row) => {
      const preview = invoicePreviews[row.invoice.id]
      if (!preview?.data && !preview?.loading && !preview?.error) {
        loadInvoicePreview(row.invoice.id)
      }
    })
  }, [currentRows, previousRows, failedRows, viewMode, invoicePreviews, loadInvoicePreview])

  const displayedRows =
    viewMode === 'history'
      ? historyRows
      : viewMode === 'current'
      ? currentRows
      : viewMode === 'failed'
      ? failedRows
      : previousRows

  const handleDownloadInvoice = async (
    invoiceId: string,
    periodMonth: number,
    periodYear: number,
    invoiceNumber?: string | null
  ) => {
    try {
      const blob = await api.users.downloadInvoicePdf(invoiceId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeNumber = invoiceNumber?.trim()
      link.download = safeNumber
        ? `${safeNumber}.pdf`
        : `invoice-${periodYear}-${String(periodMonth).padStart(2, '0')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setError('Failed to download invoice')
    }
  }

  const handleDownloadCreditNote = async (
    invoiceId: string,
    noteId: string,
    invoiceNumber?: string | null
  ) => {
    try {
      const blob = await api.users.downloadCreditNotePdf(invoiceId, noteId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeNumber = invoiceNumber?.trim()
      link.download = safeNumber ? `CN-${safeNumber}.pdf` : 'credit-note.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      setError('Failed to download credit note')
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

  const loadAdjustments = async (invoiceId: string) => {
    setAdjustmentsLoading(true)
    const response = await api.users.getInvoiceAdjustments(invoiceId)

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to load adjustments')
      setAdjustmentsLoading(false)
      return
    }

    setAdjustments(response.data)
    setAdjustmentsLoading(false)
  }

  const startEditCreditNote = (note: { id: string; amount: number; reason: string | null }) => {
    setEditingCreditNoteId(note.id)
    setEditingCreditNoteAmount(String(note.amount))
    setEditingCreditNoteReason(note.reason || '')
  }

  const startEditAdjustment = (adjustment: { id: string; amount: number; reason: string | null }) => {
    setEditingAdjustmentId(adjustment.id)
    setEditingAdjustmentAmount(String(adjustment.amount))
    setEditingAdjustmentReason(adjustment.reason || '')
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
    await loadHistory()
    setUpdating(null)
  }

  const handleCreateAdjustment = async (invoiceId: string) => {
    const amount = Number(adjustmentAmount)
    if (!amount || amount === 0) {
      setError('Adjustment amount must be non-zero')
      return
    }

    setUpdating(invoiceId)
    const response = await api.users.createInvoiceAdjustment(invoiceId, {
      amount,
      reason: adjustmentReason || undefined,
    })

    if (!response.success) {
      setError(response.error || 'Failed to create adjustment')
      setUpdating(null)
      return
    }

    setAdjustmentAmount('')
    setAdjustmentReason('')
    await loadAdjustments(invoiceId)
    await loadPreviousInvoices()
    await loadInvoicePreview(invoiceId)
    setUpdating(null)
  }

  const handleUpdateAdjustment = async (invoiceId: string, adjustmentId: string) => {
    const amount = Number(editingAdjustmentAmount)
    if (!amount || amount === 0) {
      setError('Adjustment amount must be non-zero')
      return
    }

    setUpdating(adjustmentId)
    const response = await api.users.updateInvoiceAdjustment(invoiceId, adjustmentId, {
      amount,
      reason: editingAdjustmentReason || undefined,
    })

    if (!response.success) {
      setError(response.error || 'Failed to update adjustment')
      setUpdating(null)
      return
    }

    setEditingAdjustmentId(null)
    setEditingAdjustmentAmount('')
    setEditingAdjustmentReason('')
    await loadAdjustments(invoiceId)
    await loadPreviousInvoices()
    await loadInvoicePreview(invoiceId)
    setUpdating(null)
  }

  const handleDeleteAdjustment = async (invoiceId: string, adjustmentId: string) => {
    setUpdating(adjustmentId)
    const response = await api.users.deleteInvoiceAdjustment(invoiceId, adjustmentId)

    if (!response.success) {
      setError(response.error || 'Failed to delete adjustment')
      setUpdating(null)
      return
    }

    await loadAdjustments(invoiceId)
    await loadPreviousInvoices()
    await loadInvoicePreview(invoiceId)
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
    await loadHistory()
    setUpdating(null)
  }

  const handleMockPayment = async (invoiceId: string) => {
    setUpdating(invoiceId)
    const targetRow =
      previousRows.find((row) => row.invoice.id === invoiceId) ||
      failedRows.find((row) => row.invoice.id === invoiceId)
    const response = await api.users.mockPayPalPayment(
      invoiceId,
      notesByInvoice[invoiceId] || undefined
    )

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to process payment')
      setUpdating(null)
      return
    }

    const nextStatus = response.data.success ? 'PAID' : 'FAILED'
    setPreviousRows((prev) => prev.filter((row) => row.invoice.id !== invoiceId))
    setFailedRows((prev) => {
      if (response.data.success) {
        return prev.filter((row) => row.invoice.id !== invoiceId)
      }
      const updatedRow = targetRow
        ? {
            ...targetRow,
            invoice: {
              ...targetRow.invoice,
              status: nextStatus,
              paidAt: null,
              adminNotes: notesByInvoice[invoiceId] || targetRow.invoice.adminNotes,
            },
          }
        : null
      if (!updatedRow) return prev
      const existingIndex = prev.findIndex((row) => row.invoice.id === invoiceId)
      if (existingIndex >= 0) {
        return prev.map((row) => (row.invoice.id === invoiceId ? updatedRow : row))
      }
      return [updatedRow, ...prev]
    })
    await loadHistory()
    const paidAt = response.data.success ? new Date().toISOString() : null
    setInvoicePreviews((prev) => {
      const existing = prev[invoiceId]
      if (!existing?.data) {
        return prev
      }
      return {
        ...prev,
        [invoiceId]: {
          loading: false,
          data: {
            ...existing.data,
            status: nextStatus,
            paidAt,
          },
        },
      }
    })
    setUpdating(null)
  }

  const handleTrashFailed = async (invoiceId: string) => {
    setUpdating(invoiceId)
    const response = await api.users.updateInvoice(invoiceId, {
      status: 'CANCELLED',
      adminNotes: notesByInvoice[invoiceId] ?? '',
    })

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to move invoice to trash')
      setUpdating(null)
      return
    }

    setFailedRows((prev) => prev.filter((row) => row.invoice.id !== invoiceId))
    setInvoicePreviews((prev) => {
      const next = { ...prev }
      delete next[invoiceId]
      return next
    })
    setUpdating(null)
  }

  const handleSaveNotes = async (invoiceId: string, status: string) => {
    setUpdating(invoiceId)
    const response = await api.users.updateInvoice(invoiceId, {
      status,
      adminNotes: notesByInvoice[invoiceId] ?? '',
    })

    if (!response.success || !response.data) {
      setError(response.error || 'Failed to save notes')
      setUpdating(null)
      return
    }

    const updateNotes = (rows: OwnerInvoiceRow[]) =>
      rows.map((row) =>
        row.invoice.id === invoiceId
          ? {
              ...row,
              invoice: {
                ...row.invoice,
                adminNotes: response.data.adminNotes,
              },
            }
          : row
      )

    setCurrentRows((prev) => updateNotes(prev))
    setPreviousRows((prev) => updateNotes(prev))
    setFailedRows((prev) => updateNotes(prev))

    setInvoicePreviews((prev) => {
      const existing = prev[invoiceId]
      if (!existing?.data) {
        return prev
      }
      return {
        ...prev,
        [invoiceId]: {
          loading: false,
          data: {
            ...existing.data,
            adminNotes: response.data.adminNotes,
          },
        },
      }
    })

    if (viewMode === 'history') {
      await loadHistory()
    }
    setUpdating(null)
  }


  const isViewLoading =
    viewMode === 'history'
      ? isHistoryLoading
      : viewMode === 'current'
      ? isCurrentLoading
      : viewMode === 'failed'
      ? isFailedLoading
      : isPreviousLoading

  if (isViewLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const historyLabel =
    historyMonth && historyYear ? `${String(historyMonth).padStart(2, '0')}/${historyYear}` : null

  const emptyStateText =
    viewMode === 'current'
      ? 'No current month totals available.'
      : viewMode === 'failed'
      ? 'No failed payments to review.'
      : viewMode === 'history'
      ? `No paid invoices for ${historyLabel || 'the selected period'}.`
      : 'No invoices to charge for the previous month.'

  const resolveDisplayTotal = (invoice: OwnerInvoiceRow['invoice']) => {
    const preview = invoicePreviews[invoice.id]?.data
    if (preview && Number.isFinite(preview.totalAmount)) {
      return preview.totalAmount
    }
    return invoice.totalAmount
  }

  const hasTotalMismatch = (invoice: OwnerInvoiceRow['invoice']) => {
    const preview = invoicePreviews[invoice.id]?.data
    if (!preview || !Number.isFinite(preview.totalAmount)) {
      return false
    }
    const roundedPreview = roundMoney(preview.totalAmount)
    const roundedInvoice = roundMoney(invoice.totalAmount)
    return Math.abs(roundedPreview - roundedInvoice) >= 0.01
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Monthly Collections</h1>
          <p className="text-sm text-gray-600">
            {viewMode === 'current'
              ? 'Live USD totals for the current month.'
              : viewMode === 'failed'
              ? 'Retry or move failed payments to trash.'
              : viewMode === 'history'
              ? 'Paid invoices and documents.'
              : 'Previous month totals ready to charge.'}
          </p>
          {viewMode === 'history' && historyLabel && (
            <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Showing: {historyLabel}
            </div>
          )}
        </div>
        <Button
          onClick={() => {
            loadCurrentInvoices()
            loadPreviousInvoices()
            loadFailedInvoices()
            if (viewMode === 'history') {
              loadHistory({ month: historyMonth, year: historyYear })
            }
          }}
          variant="outline"
        >
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
          variant={viewMode === 'previous' ? 'default' : 'outline'}
          onClick={() => setViewMode('previous')}
        >
          Previous Month
        </Button>
        <Button
          variant={viewMode === 'failed' ? 'default' : 'outline'}
          onClick={() => setViewMode('failed')}
        >
          Failed
        </Button>
        <Button
          variant={viewMode === 'history' ? 'default' : 'outline'}
          onClick={() => {
            setViewMode('history')
            const defaults = getPreviousMonthFromDate(new Date())
            setHistoryMonth(defaults.month)
            setHistoryYear(defaults.year)
            loadHistory({ month: defaults.month, year: defaults.year })
          }}
        >
          History
        </Button>
      </div>

      {error && !shouldIgnoreError(error) && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6 space-y-4">
          <div className={`grid gap-4 ${viewMode === 'history' ? 'max-h-[640px] overflow-y-auto pr-1' : ''}`}>
            {viewMode === 'history' && isHistoryLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                Loading history...
              </div>
            ) : (
              displayedRows.map((row) => {
                const ownerName = `${row.owner.firstName || ''} ${row.owner.lastName || ''}`.trim()
                const invoice = row.invoice
                const isUpdatingRow = updating === invoice.id
                const isHistoryView = viewMode === 'history'
                const isTrackingView = viewMode === 'current'
                const isPreviousView = viewMode === 'previous'
                const isFailedView = viewMode === 'failed'
                const previewState = invoicePreviews[invoice.id]
                const detail = previewState?.data
                const formattedPeriod = formatMonthYear(invoice.periodMonth, invoice.periodYear)
                const periodRange = getPeriodRange(invoice.periodMonth, invoice.periodYear)
                return (
                  <div
                    key={invoice.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="space-y-2 min-w-[240px]">
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
                          Period: {formattedPeriod}
                        </div>
                        {invoice.invoiceNumber && (
                          <div className="text-xs text-gray-500 font-mono">
                            {invoice.invoiceNumber}
                          </div>
                        )}
                      </div>

                      <div className="text-right space-y-2">
                        <div className="text-sm text-gray-500">
                          {isTrackingView ? 'Current month total' : 'Amount due'}
                        </div>
                        <div className="text-2xl font-semibold text-gray-900">
                          {formatUsd(resolveDisplayTotal(invoice))}
                        </div>
                        {hasTotalMismatch(invoice) && (
                          <div className="text-xs text-amber-600">
                            Total updated by recalculation.
                          </div>
                        )}
                        {isHistoryView && invoice.creditNotesTotal && invoice.creditNotesTotal > 0 && (
                          <div className="text-xs text-emerald-600">
                            Credit notes: -{formatUsd(invoice.creditNotesTotal ?? 0)}
                          </div>
                        )}
                        {!isHistoryView && !isTrackingView && !isFailedView && (
                          <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                            <span>Payment:</span>
                            {renderPaymentToggle(invoice.status)}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isHistoryView && (
                      <div className="mt-4 space-y-3 rounded-xl border border-dashed border-gray-200 bg-slate-50/80 p-4 text-sm text-gray-700">
                        {previewState?.loading ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading invoice preview...
                          </div>
                        ) : detail ? (
                            <div className="space-y-3">
                            <div className="space-y-1.5 text-sm text-gray-600">
                              <div className="flex items-center justify-between">
                                <span>Subscription</span>
                                <span>{formatUsd(detail.subscriptionAmount)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Recharges this month</span>
                                <span>{formatUsd(detail.rechargesTotal)}</span>
                              </div>
                              {!isTrackingView && detail.adjustmentsTotal !== 0 && (
                                <div className="flex items-center justify-between">
                                  <span>Adjustments</span>
                                  <span>{formatUsd(detail.adjustmentsTotal)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span>Taxes ({(detail.taxRate * 100).toFixed(0)}%)</span>
                                <span>{formatUsd(detail.taxAmount)}</span>
                              </div>
                              <div className="flex items-center justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900">
                                <span>Total</span>
                                <span>{formatUsd(detail.totalAmount)}</span>
                              </div>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Invoice covers {formatDate(periodRange.start)} – {formatDate(periodRange.end)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">Invoice preview unavailable.</div>
                        )}
                      </div>
                    )}

                    {isPreviousView && (
                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center">
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
                          onClick={() => handleSaveNotes(invoice.id, invoice.status)}
                          disabled={isUpdatingRow}
                        >
                          Save Notes
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleDownloadInvoice(
                              invoice.id,
                              invoice.periodMonth,
                              invoice.periodYear,
                              invoice.invoiceNumber
                            )
                          }
                          disabled={isUpdatingRow || invoice.status !== 'PAID'}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            setAdjustmentModal({ invoiceId: invoice.id })
                            await loadAdjustments(invoice.id)
                          }}
                          disabled={isUpdatingRow}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Adjustments
                        </Button>
                        <Button
                          variant="default"
                          onClick={() => handleMockPayment(invoice.id)}
                          disabled={isUpdatingRow || invoice.status === 'PAID'}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Process Payment
                        </Button>
                      </div>
                    )}

                    {isFailedView && (
                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
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
                          onClick={() => handleMockPayment(invoice.id)}
                          disabled={isUpdatingRow}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Retry Payment
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleTrashFailed(invoice.id)}
                          disabled={isUpdatingRow}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Move to Trash
                        </Button>
                      </div>
                    )}

                    {isHistoryView && (
                      <div className="mt-4 space-y-3">
                        {invoice.paidAt && (
                          <div className="text-xs text-slate-500">
                            Paid on {new Date(invoice.paidAt).toLocaleDateString('it-IT')}
                          </div>
                        )}
                        {invoice.adminNotes && (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">Admin notes:</span>{' '}
                            {invoice.adminNotes}
                          </div>
                        )}
                        <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50/80 p-4 text-sm text-gray-700">
                          {previewState?.loading ? (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading invoice summary...
                            </div>
                          ) : detail ? (
                            <div className="space-y-2 text-sm text-gray-600">
                              <div className="flex items-center justify-between">
                                <span>Subscription</span>
                                <span>{formatUsd(detail.subscriptionAmount)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Recharges this month</span>
                                <span>{formatUsd(detail.rechargesTotal)}</span>
                              </div>
                              {detail.adjustmentsTotal !== 0 && (
                                <div className="flex items-center justify-between">
                                  <span>Adjustments</span>
                                  <span>{formatUsd(detail.adjustmentsTotal)}</span>
                                </div>
                              )}
                              {detail.creditNotesTotal > 0 && (
                                <div className="flex items-center justify-between text-emerald-700">
                                  <span>Credit notes</span>
                                  <span>-{formatUsd(detail.creditNotesTotal)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span>Taxes ({(detail.taxRate * 100).toFixed(0)}%)</span>
                                <span>{formatUsd(detail.taxAmount)}</span>
                              </div>
                              <div className="flex items-center justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900">
                                <span>Total</span>
                                <span>{formatUsd(detail.totalAmount)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">Invoice summary unavailable.</div>
                          )}
                        </div>
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Documents
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleDownloadInvoice(
                                invoice.id,
                                invoice.periodMonth,
                                invoice.periodYear,
                                invoice.invoiceNumber
                              )
                            }
                            disabled={isUpdatingRow || invoice.status !== 'PAID'}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Invoice PDF
                          </Button>
                          {invoice.status === 'PAID' && (
                            <Button
                              variant="secondary"
                              onClick={async () => {
                                setCreditNoteModal({ invoiceId: invoice.id })
                                await loadCreditNotes(invoice.id)
                              }}
                              disabled={isUpdatingRow}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Add Credit Note
                            </Button>
                          )}
                        </div>
                        {invoice.creditNotes && invoice.creditNotes.length > 0 && (
                          <div className="space-y-2">
                            {invoice.creditNotes.map((note) => (
                              <div
                                key={note.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                              >
                                <div>
                                  <div className="font-medium text-slate-900">
                                    Credit note {note.reason ? `• ${note.reason}` : ''}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {new Date(note.createdAt).toLocaleDateString('it-IT')}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-emerald-700">
                                    -{formatUsd(note.amount)}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleDownloadCreditNote(
                                        invoice.id,
                                        note.id,
                                        invoice.invoiceNumber
                                      )
                                    }
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    PDF
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {displayedRows.length === 0 && !isHistoryLoading && (
              <div className="text-center text-sm text-gray-500 py-8">
                {emptyStateText}
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
                      <div className="text-sm font-medium">{formatUsd(note.amount)}</div>
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
              Close
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

      <Dialog
        open={!!adjustmentModal}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustmentModal(null)
            setAdjustmentAmount('')
            setAdjustmentReason('')
            setAdjustments([])
            setEditingAdjustmentId(null)
            setEditingAdjustmentAmount('')
            setEditingAdjustmentReason('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjustments</DialogTitle>
            <DialogDescription>Modify charge lines before payment.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adjustmentAmount">New adjustment amount</Label>
              <Input
                id="adjustmentAmount"
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
              />
              <p className="text-xs text-slate-500">Use negative values for discounts.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustmentReason">Reason</Label>
              <Input
                id="adjustmentReason"
                placeholder="Optional reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
              />
            </div>
            <Button
              onClick={() => adjustmentModal && handleCreateAdjustment(adjustmentModal.invoiceId)}
              disabled={!adjustmentModal || !!updating}
            >
              Add adjustment
            </Button>
          </div>

          <div className="space-y-3">
            <Label>Existing adjustments</Label>
            {adjustmentsLoading ? (
              <div className="text-sm text-gray-500">Loading adjustments...</div>
            ) : adjustments.length === 0 ? (
              <div className="text-sm text-gray-500">No adjustments yet.</div>
            ) : (
              adjustments.map((adj) => (
                <div key={adj.id} className="rounded border border-gray-200 p-3">
                  {editingAdjustmentId === adj.id ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={editingAdjustmentAmount}
                        onChange={(e) => setEditingAdjustmentAmount(e.target.value)}
                      />
                      <Input
                        type="text"
                        placeholder="Reason"
                        value={editingAdjustmentReason}
                        onChange={(e) => setEditingAdjustmentReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            adjustmentModal &&
                            handleUpdateAdjustment(adjustmentModal.invoiceId, adj.id)
                          }
                          disabled={!!updating}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingAdjustmentId(null)
                            setEditingAdjustmentAmount('')
                            setEditingAdjustmentReason('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{formatUsd(adj.amount)}</div>
                      <div className="text-xs text-gray-500">{adj.reason || 'No reason'}</div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => startEditAdjustment(adj)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            adjustmentModal &&
                            handleDeleteAdjustment(adjustmentModal.invoiceId, adj.id)
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
        </DialogContent>
      </Dialog>

    </div>
  )
}
