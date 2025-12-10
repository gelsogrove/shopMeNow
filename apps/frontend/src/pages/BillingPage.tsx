import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText } from "lucide-react"
import { 
  getCurrentInvoice, 
  getOwnerInvoices, 
  getOwnerBillingOverview,
  Invoice, 
  InvoiceStatus,
  BillingOverview
} from "@/services/subscriptionBillingApi"
import { format } from "date-fns"

const TAX_RATE = 0.22 // 22% IVA

export function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null)
  const [pastInvoices, setPastInvoices] = useState<Invoice[]>([])
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInvoices()
  }, [])

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

      // Load past invoices (paid ones)
      const result = await getOwnerInvoices(1, 100)
      const paid = result.invoices.filter((inv: Invoice) => inv.status === "PAID")
      setPastInvoices(paid)
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
    }).format(amount)
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
  const subtotal = subscriptionFee + totalRecharges
  const taxAmount = subtotal * TAX_RATE
  const total = subtotal + taxAmount
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

      {/* Current Month Summary - styled like the image */}
      <Card>
        <CardHeader>
          <CardTitle>Current Month</CardTitle>
          <CardDescription>Your billing summary for the current period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Subscription row */}
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Subscription {planName}:</span>
              <span className="font-medium text-green-600">{formatCurrency(subscriptionFee)}</span>
            </div>
            
            {/* Recharges this month row */}
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Recharges this month:</span>
              <span className="font-medium text-green-600">{formatCurrency(totalRecharges)}</span>
            </div>
            
            {/* Taxes row */}
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Taxes:</span>
              <span className="font-medium text-green-600">{(TAX_RATE * 100).toFixed(0)}%</span>
            </div>
            
            {/* Separator line */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* Total row */}
            <div className="flex justify-between items-center py-2">
              <span className="font-semibold">Total (incl. taxes):</span>
              <span className="font-bold text-lg text-green-600">{formatCurrency(total)}</span>
            </div>
            
            {/* Next renewal row */}
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Next renewal:</span>
              <span className="font-medium">
                {format(nextBillingDate, "d/M/yyyy")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid On</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {formatPeriod(invoice.periodMonth, invoice.periodYear)}
                    </TableCell>
                    <TableCell>{invoice.planType}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      {invoice.paidAt ? format(new Date(invoice.paidAt), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default BillingPage
