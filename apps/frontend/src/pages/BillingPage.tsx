import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { 
  getCurrentInvoice, 
  getOwnerInvoices, 
  getOwnerBillingOverview,
  downloadInvoicePdf,
  downloadCreditNotePdf,
  Invoice, 
  InvoiceStatus,
  BillingOverview
} from "@/services/subscriptionBillingApi"
import { format } from "date-fns"
import { toast } from "@/lib/toast"
import { roundMoney } from "@/utils/money"

const TAX_RATE = 0.22 // 22% IVA
const ITEMS_PER_PAGE = 10

export function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null)
  const [pastInvoices, setPastInvoices] = useState<Invoice[]>([])
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    loadInvoices()
  }, [currentPage])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load billing overview (for monthly plan info)
      try {
        const overview = await getOwnerBillingOverview()
        setBillingOverview(overview)
      } catch {
        setBillingOverview(null)
      }

      // Load current invoice
      try {
        const current = await getCurrentInvoice()
        setCurrentInvoice(current)
      } catch {
        setCurrentInvoice(null)
      }

      // Load past invoices with pagination (show PAID, PENDING and FAILED)
      const result = await getOwnerInvoices(currentPage, ITEMS_PER_PAGE)
      const closedInvoices = result.invoices.filter((inv: Invoice) =>
        ["PAID", "PENDING", "FAILED"].includes(inv.status)
      )
      setPastInvoices(closedInvoices)
      setTotalPages(Math.ceil(result.total / ITEMS_PER_PAGE) || 1)
    } catch (err) {
      console.error("Failed to load invoices:", err)
      setError("Failed to load billing information")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(roundMoney(amount))
  }

  const handleDownloadInvoice = async (
    invoiceId: string,
    periodMonth: number,
    periodYear: number,
    invoiceNumber?: string | null
  ) => {
    try {
      const blob = await downloadInvoicePdf(invoiceId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      const safeNumber = invoiceNumber?.trim()
      link.download = safeNumber
        ? `${safeNumber}.pdf`
        : `invoice-${periodYear}-${String(periodMonth).padStart(2, "0")}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download invoice:", error)
      toast.error("Failed to download invoice")
    }
  }

  const handleDownloadCreditNote = async (
    invoiceId: string,
    noteId: string,
    invoiceNumber?: string | null
  ) => {
    try {
      const blob = await downloadCreditNotePdf(invoiceId, noteId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      const safeNumber = invoiceNumber?.trim()
      link.download = safeNumber ? `CN-${safeNumber}.pdf` : "credit-note.pdf"
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download credit note:", error)
      toast.error("Failed to download credit note")
    }
  }

  const getStatusBadge = (status: InvoiceStatus) => {
    const variants: Record<InvoiceStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      DRAFT: { variant: "secondary", label: "Draft" },
      PENDING: { variant: "outline", label: "Pending" },
      PAID: { variant: "default", label: "Paid" },
      FAILED: { variant: "destructive", label: "Failed" },
      CANCELLED: { variant: "secondary", label: "Cancelled" },
    }
    const config = variants[status] || { variant: "secondary" as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatPeriod = (month: number, year: number) => {
    const date = new Date(year, month - 1)
    return format(date, "MMMM yyyy")
  }

  // Calculate current month billing
  const subscriptionFee = billingOverview?.planConfig?.monthlyFee || billingOverview?.limits?.monthlyFee || 0
  const totalRecharges = billingOverview?.billing?.totalRecharges || 0
  const subtotal = roundMoney(subscriptionFee + totalRecharges)
  const taxAmount = roundMoney(subtotal * TAX_RATE)
  const total = roundMoney(subtotal + taxAmount)
  const nextBillingDate = billingOverview?.billing?.nextBillingDate 
    ? new Date(billingOverview.billing.nextBillingDate) 
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) // 1st of next month
  const planName = billingOverview?.planConfig?.displayName || billingOverview?.billing?.planType || "Basic"

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-600">Billing</h1>
        <p className="text-muted-foreground">View your subscription and billing history</p>
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice History
          </CardTitle>
          <CardDescription>Your past paid invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {pastInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No past invoices</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid On</TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div>{formatPeriod(invoice.periodMonth, invoice.periodYear)}</div>
                          {invoice.invoiceNumber && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {invoice.invoiceNumber}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{invoice.planType}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        {invoice.paidAt ? format(new Date(invoice.paidAt), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                            handleDownloadInvoice(
                              invoice.id,
                              invoice.periodMonth,
                              invoice.periodYear,
                              invoice.invoiceNumber
                            )
                            }
                          >
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                          {(invoice.creditNotes || []).map((note) => (
                            <Button
                              key={note.id}
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDownloadCreditNote(
                                invoice.id,
                                note.id,
                                invoice.invoiceNumber
                              )}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Credit PDF
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default BillingPage
