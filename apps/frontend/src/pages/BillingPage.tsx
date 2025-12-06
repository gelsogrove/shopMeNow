/**
 * Billing Page - Monthly Invoices
 * Feature 185: Subscription & Billing System
 *
 * Dedicated page showing monthly invoices directly
 * Uses MinimalLayout (header already provided by layout)
 */

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { api } from "@/services/api"
import { workspaceApi } from "@/services/workspaceApi"
import { 
  FileText,
  Loader2,
  Download,
} from "lucide-react"
import { useEffect, useState } from "react"

// Plan configurations for display
const PLAN_CONFIGS = {
  FREE_TRIAL: { name: "Free Trial", price: 0 },
  BASIC: { name: "Basic", price: 19 },
  PREMIUM: { name: "Premium", price: 49 },
  ENTERPRISE: { name: "Enterprise", price: 99 },
}

// Transaction type from backend
interface Transaction {
  id: string
  type: string
  amount: number
  balanceAfter: number
  createdAt: string
  metadata?: Record<string, any>
}

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export default function BillingPage() {
  // Workspace and billing state
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [planType, setPlanType] = useState<string>("FREE_TRIAL")

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true)
      const workspaces = await workspaceApi.getAll()
      logger.info('📦 [BillingPage] Workspaces loaded:', workspaces?.length || 0)
      if (workspaces && workspaces.length > 0) {
        // Use first active workspace
        const activeWs = workspaces.find((w: any) => w.isActive && !w.isDelete) || workspaces[0]
        setWorkspaceId(activeWs.id)
        setPlanType(activeWs.planType || 'FREE_TRIAL')
        logger.info('📦 [BillingPage] Using workspace:', activeWs.id, 'Plan:', activeWs.planType)
        
        // Load transactions for this workspace
        loadTransactions(activeWs.id)
      } else {
        logger.warn('📦 [BillingPage] No workspaces found')
        setIsLoading(false)
      }
    } catch (error) {
      logger.error('Failed to load workspaces:', error)
      toast.error('Failed to load workspaces')
      setIsLoading(false)
    }
  }

  const loadTransactions = async (wsId: string) => {
    try {
      setIsLoadingTransactions(true)
      const response = await api.get(`/workspaces/${wsId}/subscription-billing/transactions`)
      setTransactions(response.data.transactions || [])
    } catch (error) {
      logger.error('Failed to load transactions:', error)
      toast.error('Failed to load invoices')
    } finally {
      setIsLoadingTransactions(false)
      setIsLoading(false) // Loading complete
    }
  }

  // Aggregate transactions by month
  const getMonthlyInvoices = () => {
    const monthlyInvoices = transactions.reduce((acc, tx) => {
      const date = new Date(tx.createdAt)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          label: monthLabel,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          recharges: 0,
          messages: 0,
          messagesCount: 0,
          pushNotifications: 0,
          pushCount: 0,
          subscriptionFee: 0,
          otherExpenses: 0,
        }
      }
      
      // Categorize transactions
      if (tx.type === "RECHARGE") {
        acc[monthKey].recharges += tx.amount
      } else if (tx.type === "MESSAGE") {
        acc[monthKey].messages += Math.abs(tx.amount)
        acc[monthKey].messagesCount++
      } else if (tx.type.startsWith("PUSH_") || tx.type === "PUSH_NOTIFICATION") {
        acc[monthKey].pushNotifications += Math.abs(tx.amount)
        acc[monthKey].pushCount++
      } else if (tx.type === "MONTHLY_FEE" || tx.type === "UPGRADE_FEE") {
        acc[monthKey].subscriptionFee += Math.abs(tx.amount)
      } else if (tx.amount < 0) {
        acc[monthKey].otherExpenses += Math.abs(tx.amount)
      }
      
      return acc
    }, {} as Record<string, {
      label: string
      year: number
      month: number
      recharges: number
      messages: number
      messagesCount: number
      pushNotifications: number
      pushCount: number
      subscriptionFee: number
      otherExpenses: number
    }>)
    
    // Sort by date (newest first)
    const sortedMonths = Object.entries(monthlyInvoices).sort((a, b) => b[0].localeCompare(a[0]))
    
    // Filter out the current month - invoices only available for COMPLETED months
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return sortedMonths.filter(([monthKey]) => monthKey < currentMonthKey)
  }

  const completedMonths = getMonthlyInvoices()
  const currentPlanConfig = PLAN_CONFIGS[planType as keyof typeof PLAN_CONFIGS]
  const monthlySubscriptionFee = currentPlanConfig?.price || 0

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-green-600" />
            Monthly Invoices
          </h1>
          <p className="text-gray-600 mt-1">Your monthly billing summary grouped by month</p>
        </div>

        {/* Invoices Content */}
        {isLoading || isLoadingTransactions ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading invoices...</p>
            </CardContent>
          </Card>
        ) : completedMonths.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No invoices available yet</p>
              <p className="text-sm text-gray-400 mt-2">Invoices are generated at the end of each month</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {completedMonths.map(([monthKey, data]) => {
              const invoiceNumber = `INV-${data.year}${String(data.month).padStart(2, '0')}`
              // Use recorded subscription fee from transactions OR current plan price
              const subscriptionFee = data.subscriptionFee > 0 ? data.subscriptionFee : monthlySubscriptionFee
              // Taxes 22% on (recharges + subscription fee)
              const subtotal = data.recharges + subscriptionFee
              const taxes = subtotal * 0.22
              // Total = Recharges + Subscription Fee + Taxes
              const totalWithTaxes = subtotal + taxes
              
              return (
                <Card key={monthKey} className="overflow-hidden">
                  {/* Month Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg capitalize">{data.label}</h3>
                      <span className="text-sm text-muted-foreground font-mono">{invoiceNumber}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        toast.info(`Invoice ${invoiceNumber} - Coming soon`)
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>

                  {/* Invoice Details Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-[150px]">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Recharges */}
                      {data.recharges > 0 && (
                        <TableRow>
                          <TableCell className="font-medium">💰 Credit Recharges</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(data.recharges)}
                          </TableCell>
                        </TableRow>
                      )}
                      
                      {/* Subscription Fee - Always show current plan price */}
                      {subscriptionFee > 0 && (
                        <TableRow>
                          <TableCell className="font-medium">📋 Subscription Fee ({currentPlanConfig?.name || planType})</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(subscriptionFee)}
                          </TableCell>
                        </TableRow>
                      )}
                      
                      {/* Other Expenses */}
                      {data.otherExpenses > 0 && (
                        <TableRow>
                          <TableCell className="font-medium">📦 Other Charges</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(data.otherExpenses)}
                          </TableCell>
                        </TableRow>
                      )}
                      
                      {/* Taxes */}
                      <TableRow>
                        <TableCell className="font-medium">Taxes (22% IVA)</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {taxes > 0 ? `+${formatCurrency(taxes)}` : '—'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Grand Total */}
                      <TableRow className="bg-gray-50 font-bold">
                        <TableCell>Monthly Balance</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totalWithTaxes)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
