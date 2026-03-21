/**
 * WasenderOnboarding - WhatsApp Self-Registration via QR Code (WasenderAPI)
 *
 * Flow:
 *  1. On mount: if sessionId exists → sync status from WasenderAPI (fixes stale DB)
 *  2. If already connected → show "Connected" state immediately
 *  3. If not connected → show "Connect WhatsApp" button (no phone number needed)
 *  4. On connect: backend creates/reuses session → returns QR string
 *  5. QR auto-refreshes every 45s via handleRegenerateQr
 *  6. Polls every 3s — when status = "connected" → onComplete()
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import QRCode from 'react-qr-code'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw, Wifi, WifiOff, CheckCircle2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  initializeWasenderSession,
  regenerateWasenderQr,
  disconnectWasenderSession,
  deleteWasenderSession,
  restartWasenderSession,
  getWasenderStatus,
  syncWasenderStatus,
} from '@/services/wasenderApi'

interface WasenderOnboardingProps {
  onComplete: () => void
  /** Optional: pass workspaceId directly (e.g. from wizard). Falls back to WorkspaceContext. */
  workspaceId?: string
  /** Optional: pre-fill phone number (e.g. from wizard Step 2). */
  initialPhoneNumber?: string
}

type SessionStatus = 'idle' | 'pending' | 'need_scan' | 'connected' | 'disconnected' | 'failed'

const QR_EXPIRY_SECONDS = 120 // Increased from 45 for better UX

export function WasenderOnboarding({ onComplete, workspaceId: workspaceIdProp }: WasenderOnboardingProps) {
  const { workspace } = useWorkspace()
  const workspaceId = workspaceIdProp ?? workspace?.id

  const [isInitializing, setIsInitializing] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  const [qrString, setQrString] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [qrAge, setQrAge] = useState(0) // seconds since QR was received
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [phoneNumber, setPhoneNumber] = useState(
    (workspace as any)?.wasenderPhoneNumber || workspace?.whatsappPhoneNumber || ''
  )
  const [sessionPhone, setSessionPhone] = useState<string | null>(null)

  const normalizeStatus = (
    status?: string | null,
    isActive?: boolean
  ): SessionStatus => {
    if (isActive) return 'connected'
    const s = (status || '').toLowerCase()
    if (s === 'connected') return 'connected'
    if (s === 'need_scan' || s === 'scan_qr' || s === 'logged_out' || s === 'expired') {
      return 'need_scan'
    }
    if (s === 'connecting' || s === 'pending') return 'pending'
    if (s === 'disconnected') return 'disconnected'
    if (s === 'failed') return 'failed'
    return 'idle'
  }

  // Ref to avoid stale closure in auto-regenerate
  const isRegeneratingRef = useRef(false)

  // ─── Load current status from DB on mount + ALWAYS sync with WasenderAPI ──
  // RULE: "il codice deve vincere" — WasenderAPI is the source of truth, not DB.
  // ALWAYS sync when sessionId exists, regardless of DB status.
  useEffect(() => {
    if (!workspaceId) {
      setLoadingInitial(false)
      return
    }

    const loadStatus = async () => {
      try {
        const data = await getWasenderStatus(workspaceId)
        const dbStatus = normalizeStatus(data.wasenderSessionStatus, data.wasenderIsActive)
        if (data.wasenderPhoneNumber) {
          setSessionPhone(data.wasenderPhoneNumber)
        }

        // ALWAYS sync with WasenderAPI to get real status or adopt orphaned sessions
        // Don't trust DB status — WasenderAPI is the single source of truth
        try {
          const synced = await syncWasenderStatus(workspaceId)
          const realStatus = normalizeStatus(synced.wasenderSessionStatus, synced.wasenderIsActive)
          setStatus(realStatus)

          if (realStatus === 'connected') {
            // Session confirmed connected by WasenderAPI → show connected page
            return
          }

          // Restore QR if still in need_scan after sync
          if (synced.wasenderQrString && realStatus === 'need_scan') {
            setQrString(synced.wasenderQrString)
            setQrAge(0)
          }
        } catch {
          // Sync failed → fall back to DB status
          const dbStatus = normalizeStatus(data.wasenderSessionStatus, data.wasenderIsActive)
          setStatus(dbStatus)
          if (data.wasenderQrString && dbStatus === 'need_scan') {
            setQrString(data.wasenderQrString)
            setQrAge(0)
          }
        }
      } catch {
        // No session yet — stay idle
      } finally {
        setLoadingInitial(false)
      }
    }

    loadStatus()
  }, [workspaceId])

  // ─── QR countdown timer ───────────────────────────────────────────────
  useEffect(() => {
    if (!qrString || status === 'connected') return

    const timer = setInterval(() => {
      setQrAge((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [qrString, status])

  const qrExpired = qrAge >= QR_EXPIRY_SECONDS

  // ─── Auto-regenerate when QR expires ─────────────────────────────────
  useEffect(() => {
    if (!qrExpired || isRegeneratingRef.current || !workspaceId) return
    if (status !== 'need_scan' && status !== 'pending') return

    const autoRegen = async () => {
      if (isRegeneratingRef.current) return
      isRegeneratingRef.current = true
      try {
        const response = await regenerateWasenderQr(workspaceId)
        setQrString(response.wasenderQrString)
        setStatus((response.wasenderSessionStatus as SessionStatus) || 'need_scan')
        setQrAge(0)
      } catch {
        // Auto-regen failed — user can click "New QR Code" manually
      } finally {
        isRegeneratingRef.current = false
      }
    }

    autoRegen()
  }, [qrExpired, workspaceId, status])

  // ─── Status polling (every 3s while waiting for scan) ────────────────
  const pollStatus = useCallback(async () => {
    if (!workspaceId) return
    try {
        const latest = await getWasenderStatus(workspaceId)
        const newStatus = normalizeStatus(latest.wasenderSessionStatus, latest.wasenderIsActive)
        setStatus(newStatus)
        if (latest.wasenderPhoneNumber) {
          setSessionPhone(latest.wasenderPhoneNumber)
        }

      if (newStatus === 'connected') {
        toast.success('WhatsApp connected successfully!')
        onComplete()
      }

      // Keep QR string up to date from webhook updates
      if (latest.wasenderQrString && latest.wasenderQrString !== qrString) {
        setQrString(latest.wasenderQrString)
        setQrAge(0)
      }
    } catch {
      // Ignore polling errors silently
    }
  }, [workspaceId, qrString, onComplete])

  useEffect(() => {
    if (status !== 'need_scan' && status !== 'pending') return

    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [status, pollStatus])

  // ─── Initialize session ───────────────────────────────────────────────
  const handleInitialize = async () => {
    if (!workspaceId) {
      toast.error('No workspace selected')
      return
    }
    if (!phoneNumber.trim()) {
      toast.error('Phone number is required to create a WhatsApp session')
      return
    }

    try {
      setIsInitializing(true)
      setQrAge(0)

      // Phone number is optional — backend uses workspace's stored phone
      const response = await initializeWasenderSession(workspaceId, {
        phoneNumber: phoneNumber.trim(),
      })

      setStatus(normalizeStatus(response.wasenderSessionStatus))

      if (response.wasenderQrString) {
        setQrString(response.wasenderQrString)
      }

      if (response.wasenderSessionStatus === 'connected') {
        toast.success('WhatsApp already connected!')
        onComplete()
      } else {
        toast.success('QR code generated — scan with WhatsApp now')
      }
    } catch (error: any) {
      const httpStatus = error.response?.status
      const code = error.response?.data?.code

      if (httpStatus === 402 || code === 'WASENDER_PLAN_LIMIT') {
        toast.error('WasenderAPI session limit reached. You need to upgrade your plan at wasenderapi.com to add more WhatsApp channels.')
      } else if (code === 'WASENDER_SUBSCRIPTION_REQUIRED') {
        toast.error('Your WasenderAPI plan does not include API access. Please upgrade to a paid plan at wasenderapi.com.')
      } else if (code === 'WASENDER_AUTH_ERROR') {
        toast.error('Invalid Wasender API Key. Please check your settings and ensure the key is correct.')
      } else if (code === 'WASENDER_SESSION_EXISTS') {
        toast.error('This WhatsApp session already exists. Try restarting or syncing status instead.')
      } else {
        toast.error(error.response?.data?.error || 'Failed to initialize WhatsApp session. Please ensure your Wasender account is active.')
      }
      setStatus('failed')
    } finally {
      setIsInitializing(false)
    }
  }

  // ─── Regenerate QR ────────────────────────────────────────────────────
  const handleRegenerateQr = async () => {
    if (!workspaceId) return

    try {
      setIsRegenerating(true)
      setQrAge(0)

      const response = await regenerateWasenderQr(workspaceId)
      setQrString(response.wasenderQrString)
      setStatus((response.wasenderSessionStatus as SessionStatus) || 'need_scan')

      toast.success('New QR code generated')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to regenerate QR code')
    } finally {
      setIsRegenerating(false)
    }
  }

  // ─── Restart session ──────────────────────────────────────────────────
  const handleRestart = async () => {
    if (!workspaceId) return
    try {
      setIsRestarting(true)
      await restartWasenderSession(workspaceId)
      toast.success('Session restarted — reconnecting...')
      setTimeout(pollStatus, 3000)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to restart session')
    } finally {
      setIsRestarting(false)
    }
  }

  // ─── Disconnect (pause) ───────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!workspaceId) return

    try {
      setIsDisconnecting(true)
      await disconnectWasenderSession(workspaceId)
      setQrString(null)
      setStatus('disconnected')
      toast.success('WhatsApp session paused')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to disconnect')
    } finally {
      setIsDisconnecting(false)
    }
  }

  // ─── Delete session ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!workspaceId) return
    if (!window.confirm('Permanently delete this WhatsApp session? This cannot be undone.')) return

    try {
      await deleteWasenderSession(workspaceId)
      setQrString(null)
      setStatus('idle')
      toast.success('WhatsApp session deleted')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete session')
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading WhatsApp status...</span>
      </div>
    )
  }

  if (status === 'connected') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <p className="font-semibold text-lg text-emerald-700">WhatsApp Connected</p>
        <p className="text-sm text-gray-500">Your WhatsApp channel is active and receiving messages.</p>
        <div className="text-xs text-gray-500 text-center">
          {sessionPhone ? `Phone: ${sessionPhone}` : 'Phone: not available'}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            disabled={isRestarting || isDisconnecting}
          >
            {isRestarting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restarting...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" /> Restart Session</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting || isRestarting}
          >
            {isDisconnecting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pausing...</>
            ) : (
              <><WifiOff className="h-4 w-4 mr-2" /> Pause Connection</>
            )}
          </Button>
        </div>
      </div>
    )
  }

  if (status === 'idle' || status === 'failed' || status === 'disconnected') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <Wifi className="h-10 w-10 text-emerald-500" />
        <div className="text-center">
          <p className="font-semibold text-gray-800">Connect WhatsApp via QR Code</p>
          <p className="text-sm text-gray-500 mt-1">
            No Meta Business Account needed — just scan a QR code with your phone.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-2">
          <Label htmlFor="ws-phone" className="text-xs text-slate-600">WhatsApp Phone (E.164)</Label>
          <Input
            id="ws-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+393331234567"
          />
          <p className="text-[11px] text-slate-400">Include country code, e.g. +39</p>
        </div>

        {status === 'failed' && (
          <Alert className="border-red-200 bg-red-50 max-w-sm">
            <AlertDescription className="text-sm text-red-700">
              Session initialization failed. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {status === 'disconnected' && (
          <Alert className="border-amber-200 bg-amber-50 max-w-sm">
            <AlertDescription className="text-sm text-amber-700">
              Session paused. Reconnect to resume receiving messages.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button onClick={handleInitialize} disabled={isInitializing || !phoneNumber.trim()}>
            {isInitializing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating QR...</>
            ) : (
              'Connect WhatsApp'
            )}
          </Button>
          {status === 'disconnected' && (
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 border-red-200 hover:bg-red-50">
              Delete Session
            </Button>
          )}
        </div>
      </div>
    )
  }

  // QR code display (status = need_scan | pending)
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="text-center">
        <p className="font-semibold text-gray-800">Scan with WhatsApp</p>
        <p className="text-sm text-gray-500 mt-1">
          Open WhatsApp → Linked Devices → Link a Device → scan this QR
        </p>
      </div>

      {qrString && !qrExpired ? (
        <div className="relative p-4 bg-white border-2 border-emerald-300 rounded-xl shadow-sm">
          <QRCode
            value={qrString}
            size={220}
            level="M"
          />
          {/* Countdown overlay */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white/80 px-1 rounded">
            {QR_EXPIRY_SECONDS - qrAge}s
          </div>
        </div>
      ) : qrExpired ? (
        <div className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm font-medium text-amber-700">Refreshing QR code...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 p-8">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-gray-500">Waiting for QR code from server...</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateQr}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Regenerating...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> New QR Code</>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-600"
          onClick={() => { setStatus('idle'); setQrString(null) }}
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center max-w-xs">
        Keep this window open while scanning. The connection status updates automatically.
      </p>
    </div>
  )
}
