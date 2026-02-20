import { useEffect, useMemo, useState } from 'react'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Megaphone, Play, Pause, Ban, RotateCw, RefreshCw } from 'lucide-react'

interface PushCampaign {
  id: string
  name: string
  status: string
  sendAt: string | null
  expectedRecipients: number
  actualSent: number
  actualFailed: number
  actualSkipped: number
  billingStatus: string
  costPerMessage: string
  createdAt: string
  updatedAt: string
}

type WizardStep = 'info' | 'recipients' | 'summary'

export default function CampaignsPage() {
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('info')
  const [name, setName] = useState('')
  const [sendAt, setSendAt] = useState<string>('')
  const [customerIdsRaw, setCustomerIdsRaw] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const recipientIds = useMemo(
    () =>
      customerIdsRaw
        .split(/[\s,;]+/)
        .map((id) => id.trim())
        .filter(Boolean),
    [customerIdsRaw]
  )

  const fetchCampaigns = async () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    const res = await api.pushCampaigns.list(workspaceId)
    if (res.success && res.data?.data) {
      setCampaigns(res.data.data)
    } else {
      setError(res.error || 'Failed to load campaigns')
    }
    setLoading(false)
  }

  useEffect(() => {
    // no auto load without workspaceId
  }, [])

  const resetWizard = () => {
    setName('')
    setSendAt('')
    setCustomerIdsRaw('')
    setWizardStep('info')
    setCreateError(null)
  }

  const handleCreate = async () => {
    if (!workspaceId) {
      setCreateError('Workspace ID is required')
      return
    }
    if (!name.trim()) {
      setCreateError('Name is required')
      return
    }
    if (recipientIds.length === 0) {
      setCreateError('At least one customer ID is required')
      return
    }
    setCreating(true)
    setCreateError(null)
    const payload = {
      name,
      sendAt: sendAt || undefined,
      recipients: { customerIds: recipientIds },
    }
    const res = await api.pushCampaigns.create(workspaceId, payload)
    setCreating(false)
    if (!res.success) {
      setCreateError(res.error || 'Failed to create campaign')
      return
    }
    setWizardOpen(false)
    resetWizard()
    fetchCampaigns()
  }

  const action = async (id: string, type: 'run' | 'pause' | 'resume' | 'cancel') => {
    if (!workspaceId) return
    setLoading(true)
    switch (type) {
      case 'run':
        await api.pushCampaigns.runNow(workspaceId, id)
        break
      case 'pause':
        await api.pushCampaigns.pause(workspaceId, id)
        break
      case 'resume':
        await api.pushCampaigns.resume(workspaceId, id)
        break
      case 'cancel':
        await api.pushCampaigns.cancel(workspaceId, id)
        break
    }
    await fetchCampaigns()
    setLoading(false)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'bg-gray-200 text-gray-800',
      SCHEDULED: 'bg-blue-100 text-blue-800',
      RUNNING: 'bg-amber-100 text-amber-800',
      COMPLETED: 'bg-emerald-100 text-emerald-800',
      FAILED: 'bg-red-100 text-red-800',
      PAUSED: 'bg-amber-100 text-amber-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }
    const cls = map[status] || 'bg-gray-100 text-gray-800'
    return <Badge className={cls.replace(' ', ' ')}>{status}</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Campaigns (WhatsApp)
          </h1>
          <p className="text-sm text-gray-500">
            Create and schedule promotional campaigns. Only WhatsApp-enabled workspaces are allowed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Workspace ID"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="w-64"
          />
          <Button onClick={fetchCampaigns} disabled={!workspaceId || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Load
          </Button>
          <Button
            onClick={() => {
              resetWizard()
              setWizardOpen(true)
            }}
            disabled={!workspaceId}
          >
            New Campaign
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid gap-4">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {c.name}
                  {statusBadge(c.status)}
                  <Badge variant="outline">{c.billingStatus}</Badge>
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Send at: {c.sendAt ? new Date(c.sendAt).toLocaleString() : 'immediate'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => fetchCampaigns()}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={() => action(c.id, 'run')}>
                  <Play className="h-4 w-4 mr-1" /> Run now
                </Button>
                <Button size="sm" variant="outline" onClick={() => action(c.id, 'pause')}>
                  <Pause className="h-4 w-4 mr-1" /> Pause
                </Button>
                <Button size="sm" variant="outline" onClick={() => action(c.id, 'resume')}>
                  <RotateCw className="h-4 w-4 mr-1" /> Resume
                </Button>
                <Button size="sm" variant="destructive" onClick={() => action(c.id, 'cancel')}>
                  <Ban className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 text-xs mb-1">Total Recipients</div>
                  <div className="font-semibold text-lg">{c.expectedRecipients}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Sent</div>
                  <div className="font-semibold text-lg text-green-600">{c.actualSent}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Failed</div>
                  <div className="font-semibold text-lg text-red-600">{c.actualFailed}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Skipped</div>
                  <div className="font-semibold text-lg text-gray-600">{c.actualSkipped}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between text-xs text-gray-500">
                <div>Cost/message: ${Number(c.costPerMessage).toFixed(2)}</div>
                <div>Created: {new Date(c.createdAt).toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        {campaigns.length === 0 && !loading && (
          <div className="text-sm text-gray-500">No campaigns found for this workspace.</div>
        )}
      </div>

      <Dialog open={wizardOpen} onOpenChange={(open) => { setWizardOpen(open); if (!open) resetWizard() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          {wizardStep === 'info' && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Promo" />
              </div>
              <div>
                <Label>Send at (optional)</Label>
                <Input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
              </div>
              <DialogFooter className="justify-between">
                <div />
                <Button onClick={() => setWizardStep('recipients')} disabled={!name.trim()}>
                  Next
                </Button>
              </DialogFooter>
            </div>
          )}
          {wizardStep === 'recipients' && (
            <div className="space-y-4">
              <div>
                <Label>Customer IDs (comma/space separated)</Label>
                <Textarea
                  rows={4}
                  value={customerIdsRaw}
                  onChange={(e) => setCustomerIdsRaw(e.target.value)}
                  placeholder="cust-1 cust-2 cust-3"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Only existing customers are supported. Opt-out/blacklist will be skipped automatically.
                </p>
              </div>
              <DialogFooter className="justify-between">
                <Button variant="outline" onClick={() => setWizardStep('info')}>
                  Back
                </Button>
                <Button onClick={() => setWizardStep('summary')} disabled={recipientIds.length === 0}>
                  Next
                </Button>
              </DialogFooter>
            </div>
          )}
          {wizardStep === 'summary' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-700 space-y-2">
                <div>
                  <strong>Name:</strong> {name}
                </div>
                <div>
                  <strong>Send at:</strong> {sendAt || 'Immediate'}
                </div>
                <div>
                  <strong>Recipients:</strong> {recipientIds.length} customers
                </div>
              </div>
              {createError && <div className="text-sm text-red-600">{createError}</div>}
              <DialogFooter className="justify-between">
                <Button variant="outline" onClick={() => setWizardStep('recipients')}>
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
