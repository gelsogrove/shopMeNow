/**
 * WasenderOnboarding - WhatsApp Self-Registration via QR Code (WasenderAPI)
 *
 * Flow:
 *  1. User clicks "Connect WhatsApp" → calls initialize endpoint
 *  2. Backend creates session + connects → returns QR string
 *  3. Frontend renders QR using react-qr-code
 *  4. Polls every 3s — when status = "connected" → onComplete()
 *  5. QR expires after 45s → user can regenerate
 */
import { useState, useEffect, useCallback } from 'react'
import QRCode from 'react-qr-code'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, Wifi, WifiOff, CheckCircle2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  initializeWasenderSession,
  regenerateWasenderQr,
  disconnectWasenderSession,
  deleteWasenderSession,
  restartWasenderSession,
  getWasenderStatus,
} from '@/services/wasenderApi'

interface WasenderOnboardingProps {
  onComplete: () => void
  /** Optional: pass workspaceId directly (e.g. from wizard). Falls back to WorkspaceContext. */
  workspaceId?: string
  /** Optional: pre-fill phone number (e.g. from wizard Step 2). */
  initialPhoneNumber?: string
}

type SessionStatus = 'idle' | 'pending' | 'need_scan' | 'connected' | 'disconnected' | 'failed'

const QR_EXPIRY_SECONDS = 45

export function WasenderOnboarding({ onComplete, workspaceId: workspaceIdProp, initialPhoneNumber }: WasenderOnboardingProps) {
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
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '')
  const [phoneError, setPhoneError] = useState('')

  // ─── Load current status from DB on mount (handles Settings re-visit) ─
  useEffect(() => {
    if (!workspaceId) {
      setLoadingInitial(false)
      return
    }
    getWasenderStatus(workspaceId)
      .then((data) => {
        const s = (data.wasenderSessionStatus as SessionStatus) || 'idle'
        setStatus(s)
        // If QR is still valid and we're in need_scan, restore it
        if (data.wasenderQrString && s === 'need_scan') {
          setQrString(data.wasenderQrString)
          setQrAge(0)
        }
        // Pre-fill phone number from DB if not already set via prop
        if (data.wasenderPhoneNumber && !initialPhoneNumber) {
          setPhoneNumber(data.wasenderPhoneNumber)
        }
      })
      .catch(() => {
        // No session yet — stay idle
      })
      .finally(() => setLoadingInitial(false))
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

  // ─── Status polling (every 3s while waiting for scan) ────────────────
  const pollStatus = useCallback(async () => {
    if (!workspaceId) return
    try {
      const latest = await getWasenderStatus(workspaceId)
      const newStatus = (latest.wasenderSessionStatus as SessionStatus) || 'idle'
      setStatus(newStatus)

      if (newStatus === 'connected') {
        toast.success('WhatsApp connected successfully!')
        onComplete()
      }

      // Keep QR string up to date from webhook updates
      if (latest.wasenderQrString && latest.wasenderQrString !== qrString) {
        setQrString(latest.wasenderQrString)
        setQrAge(0)
      }
    } catch (err) {
      // Ignore polling errors silently
    }
  }, [workspaceId, qrString, onComplete])

  useEffect(() => {
    if (status !== 'need_scan' && status !== 'pending') return

    const interval = setInterval(pollStatus, 3000)
    return () => clearInterval(interval)
  }, [status, pollStatus])

  // ─── Initialize session ───────────────────────────────────────────────
  const handleInitialize = async () => {
    if (!workspaceId) {
      toast.error('No workspace selected')
      return
    }

    // Validate phone number — must be E.164 format
    const trimmed = phoneNumber.trim()
    if (!trimmed) {
      setPhoneError('Phone number is required')
      return
    }
    if (!trimmed.startsWith('+') || trimmed.length < 8) {
      setPhoneError('Use international format, e.g. +393331234567')
      return
    }
    setPhoneError('')

    try {
      setIsInitializing(true)
      setQrAge(0)

      const response = await initializeWasenderSession(workspaceId, { phoneNumber: trimmed })

      setStatus((response.wasenderSessionStatus as SessionStatus) || 'pending')

      if (response.wasenderQrString) {
        setQrString(response.wasenderQrString)
      }

      toast.success('QR code generated — scan with WhatsApp now')
    } catch (error: any) {
      const httpStatus = error.response?.status
      const code = error.response?.data?.code

      if (httpStatus === 402 || code === 'WASENDER_PLAN_LIMIT') {
        toast.error('WasenderAPI session limit reached — upgrade your plan at wasenderapi.com to add more channels')
      } else if (code === 'WASENDER_SUBSCRIPTION_REQUIRED') {
        toast.error('WasenderAPI requires a paid subscription. Free plan does not include API access. Please upgrade at wasenderapi.com')
      } else if (code === 'WASENDER_AUTH_ERROR') {
        toast.error('WasenderAPI configuration error — contact your administrator')
      } else {
        // Show full error detail for debugging
        const detail = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to start WhatsApp session'
        toast.error(detail)
        console.error('[WasenderOnboarding] Initialize error:', { httpStatus, code, detail, fullResponse: error.response?.data })
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
      // After restart the session will emit session.status events via webhook
      // which will update the DB. Poll to reflect new state.
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

  // Loading initial status from DB
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

        {/* Phone number input */}
        <div className="w-full max-w-xs space-y-1">
          <Label htmlFor="wasender-phone" className="text-sm font-medium text-gray-700">
            WhatsApp Phone Number
          </Label>
          <Input
            id="wasender-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value)
              if (phoneError) setPhoneError('')
            }}
            placeholder="+393331234567"
            className={phoneError ? 'border-red-400 focus:ring-red-400' : ''}
            disabled={isInitializing}
          />
          {phoneError && (
            <p className="text-xs text-red-500">{phoneError}</p>
          )}
          <p className="text-xs text-gray-400">International format with country code (e.g. +39 for Italy)</p>
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
          <Button onClick={handleInitialize} disabled={isInitializing}>
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
          <RefreshCw className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium text-amber-700">QR code expired</p>
          <p className="text-xs text-amber-600">QR codes expire after 45 seconds</p>
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
