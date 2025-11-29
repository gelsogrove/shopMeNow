import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  RefreshCw,
  Save,
  Edit,
  X,
  Loader2,
  XCircle,
  Euro,
  TrendingDown
} from 'lucide-react'

interface PriceConfig {
  key: string
  current: number
  original: number | null
  description: string | null
  isEditing?: boolean
  editValue?: string
  editOriginal?: string
}

interface LimitConfig {
  key: string
  value: number
  description: string | null
  isEditing?: boolean
  editValue?: string
}

export function PricingPage() {
  const [prices, setPrices] = useState<PriceConfig[]>([])
  const [limits, setLimits] = useState<LimitConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.getAdminConfig()
      if (response.success && response.data) {
        setPrices(response.data.prices.map(p => ({ ...p, isEditing: false })))
        setLimits(response.data.limits.map(l => ({ ...l, isEditing: false })))
      } else {
        setError(response.error || 'Failed to fetch configuration')
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const startEditing = (key: string, type: 'price' | 'limit') => {
    if (type === 'price') {
      setPrices(prev => prev.map(p => 
        p.key === key 
          ? { ...p, isEditing: true, editValue: p.current.toString(), editOriginal: p.original?.toString() || '' }
          : p
      ))
    } else {
      setLimits(prev => prev.map(l => 
        l.key === key 
          ? { ...l, isEditing: true, editValue: l.value.toString() }
          : l
      ))
    }
  }

  const cancelEditing = (key: string, type: 'price' | 'limit') => {
    if (type === 'price') {
      setPrices(prev => prev.map(p => 
        p.key === key ? { ...p, isEditing: false } : p
      ))
    } else {
      setLimits(prev => prev.map(l => 
        l.key === key ? { ...l, isEditing: false } : l
      ))
    }
  }

  const savePrice = async (key: string) => {
    const price = prices.find(p => p.key === key)
    if (!price || !price.editValue) return

    setIsSaving(key)
    try {
      const response = await api.updateConfig(
        key, 
        price.editValue, 
        price.editOriginal || undefined
      )
      if (response.success) {
        setPrices(prev => prev.map(p => 
          p.key === key 
            ? { 
                ...p, 
                current: parseFloat(price.editValue!), 
                original: price.editOriginal ? parseFloat(price.editOriginal) : null,
                isEditing: false 
              }
            : p
        ))
      } else {
        setError(response.error || 'Failed to save')
      }
    } catch (err) {
      setError('Failed to save price')
      console.error(err)
    } finally {
      setIsSaving(null)
    }
  }

  const saveLimit = async (key: string) => {
    const limit = limits.find(l => l.key === key)
    if (!limit || !limit.editValue) return

    setIsSaving(key)
    try {
      const response = await api.updateConfig(key, limit.editValue)
      if (response.success) {
        setLimits(prev => prev.map(l => 
          l.key === key 
            ? { ...l, value: parseInt(limit.editValue!), isEditing: false }
            : l
        ))
      } else {
        setError(response.error || 'Failed to save')
      }
    } catch (err) {
      setError('Failed to save limit')
      console.error(err)
    } finally {
      setIsSaving(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Group prices by category
  const planPrices = prices.filter(p => p.key.includes('MONTHLY'))
  const usagePrices = prices.filter(p => !p.key.includes('MONTHLY'))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pricing Configuration</h1>
          <p className="text-gray-500 mt-1">
            Manage subscription plans, usage costs, and limits
          </p>
        </div>
        <Button variant="outline" onClick={fetchConfig}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
          <XCircle className="h-5 w-5" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Subscription Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Subscription Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-semibold">Plan</th>
                  <th className="pb-3 font-semibold">Current Price</th>
                  <th className="pb-3 font-semibold">Original (Strikethrough)</th>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {planPrices.map((price) => (
                  <tr key={price.key} className="border-b">
                    <td className="py-4 font-medium">{price.key}</td>
                    <td className="py-4">
                      {price.isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={price.editValue}
                          onChange={(e) => setPrices(prev => prev.map(p => 
                            p.key === price.key ? { ...p, editValue: e.target.value } : p
                          ))}
                          className="w-24"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-green-600">
                          €{price.current.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-4">
                      {price.isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={price.editOriginal}
                          onChange={(e) => setPrices(prev => prev.map(p => 
                            p.key === price.key ? { ...p, editOriginal: e.target.value } : p
                          ))}
                          className="w-24"
                          placeholder="Optional"
                        />
                      ) : price.original ? (
                        <span className="flex items-center gap-1 text-gray-400">
                          <TrendingDown className="h-4 w-4 text-green-500" />
                          <span className="line-through">€{price.original.toFixed(2)}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-4 text-sm text-gray-500 max-w-xs truncate">
                      {price.description}
                    </td>
                    <td className="py-4 text-right">
                      {price.isEditing ? (
                        <div className="flex gap-2 justify-end">
                          {isSaving === price.key ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Button size="sm" onClick={() => savePrice(price.key)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => cancelEditing(price.key, 'price')}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEditing(price.key, 'price')}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Usage Costs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Usage Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Cost</th>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usagePrices.map((price) => (
                  <tr key={price.key} className="border-b">
                    <td className="py-4 font-medium">{price.key}</td>
                    <td className="py-4">
                      {price.isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={price.editValue}
                          onChange={(e) => setPrices(prev => prev.map(p => 
                            p.key === price.key ? { ...p, editValue: e.target.value } : p
                          ))}
                          className="w-24"
                        />
                      ) : (
                        <span className="text-lg font-semibold">
                          €{price.current.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-sm text-gray-500 max-w-xs truncate">
                      {price.description}
                    </td>
                    <td className="py-4 text-right">
                      {price.isEditing ? (
                        <div className="flex gap-2 justify-end">
                          {isSaving === price.key ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Button size="sm" onClick={() => savePrice(price.key)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => cancelEditing(price.key, 'price')}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEditing(price.key, 'price')}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-semibold">Limit</th>
                  <th className="pb-3 font-semibold">Value</th>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {limits.map((limit) => (
                  <tr key={limit.key} className="border-b">
                    <td className="py-4 font-medium">{limit.key}</td>
                    <td className="py-4">
                      {limit.isEditing ? (
                        <Input
                          type="number"
                          value={limit.editValue}
                          onChange={(e) => setLimits(prev => prev.map(l => 
                            l.key === limit.key ? { ...l, editValue: e.target.value } : l
                          ))}
                          className="w-24"
                        />
                      ) : (
                        <span className="text-lg font-semibold">
                          {limit.value === 999999 ? '∞' : limit.value}
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-sm text-gray-500 max-w-xs truncate">
                      {limit.description}
                    </td>
                    <td className="py-4 text-right">
                      {limit.isEditing ? (
                        <div className="flex gap-2 justify-end">
                          {isSaving === limit.key ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Button size="sm" onClick={() => saveLimit(limit.key)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => cancelEditing(limit.key, 'limit')}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEditing(limit.key, 'limit')}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
