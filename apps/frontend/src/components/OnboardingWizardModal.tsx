/**
 * OnboardingWizardModal
 *
 * Full-screen guided onboarding for new users:
 *   Business → Channel → Auth → 2FA setup → Workspace creation → WhatsApp QR → Done
 *
 * Handles the complete auth flow inline (no page navigation) supporting both
 * email/password registration and Google OAuth.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import QRCode from 'react-qr-code'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, CheckCircle2, RefreshCw, ChevronLeft, Eye, EyeOff, Shield, Wifi, PartyPopper } from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '@/services/api'
import { storage } from '@/lib/storage'
import { createWorkspace } from '@/services/workspaceApi'
import { initializeWasenderSession, regenerateWasenderQr, getWasenderStatus } from '@/services/wasenderApi'
import { useLanguage } from '@/contexts/LanguageContext'
import { logger } from '@/lib/logger'
import { OWT, INDUSTRIES, type OWTLang, type Industry } from './onboardingWizardTranslations'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '988195920488-caj4sdf4t7elrsdedk36a5n5t1ndki4c.apps.googleusercontent.com'
const QR_EXPIRY = 45

type WizardStep = 'business' | 'channel' | 'auth' | 'totp' | 'creating' | 'qr-scan' | 'done'

interface Props {
  open: boolean
  onClose: () => void
}

// Map step → visual progress (0–100)
const STEP_PROGRESS: Record<WizardStep, number> = {
  business: 15, channel: 35, auth: 55, totp: 75, creating: 88, 'qr-scan': 95, done: 100,
}

// ─── Password validation ─────────────────────────────────────────────────────
function validatePassword(p: string): string | null {
  if (p.length < 8) return 'Min 8 characters'
  if (!/[A-Z]/.test(p)) return 'Need at least one uppercase letter'
  if (!/[a-z]/.test(p)) return 'Need at least one lowercase letter'
  if (!/[0-9]/.test(p)) return 'Need at least one number'
  if (!/[^A-Za-z0-9]/.test(p)) return 'Need at least one special character'
  return null
}

export function OnboardingWizardModal({ open, onClose }: Props) {
  const { language } = useLanguage()
  const lang: OWTLang = (['it', 'en', 'es', 'pt'] as const).includes(language as OWTLang)
    ? (language as OWTLang)
    : 'en'
  const t = OWT[lang]
  const navigate = useNavigate()

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('business')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Step 1: Business ──────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState<Industry>('other')

  // ── Step 2: Channel ───────────────────────────────────────────────────────
  const [phoneNumber, setPhoneNumber] = useState('')

  // ── Step 3: Auth ──────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [gdprAccepted, setGdprAccepted] = useState(false)

  // ── After auth response ───────────────────────────────────────────────────
  const [pendingUserId, setPendingUserId] = useState('')
  const [totpQrCode, setTotpQrCode] = useState('')   // otpauth:// URL for Google Authenticator
  const [isNewUser, setIsNewUser] = useState(true)   // true = show QR + verify, false = verify only
  const [totpCode, setTotpCode] = useState('')

  // ── Workspace / wasender ──────────────────────────────────────────────────
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState('')
  const [qrString, setQrString] = useState('')
  const [qrAge, setQrAge] = useState(0)
  const [wasenderStatus, setWasenderStatus] = useState<'idle' | 'pending' | 'need_scan' | 'connected' | 'failed'>('idle')
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false)
  const [creatingPhase, setCreatingPhase] = useState(0)

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setStep('business'); setError('')
    setBusinessName(''); setIndustry('other'); setPhoneNumber('')
    setFirstName(''); setLastName(''); setEmail(''); setPassword(''); setGdprAccepted(false)
    setPendingUserId(''); setTotpQrCode(''); setTotpCode('')
    setCreatedWorkspaceId(''); setQrString(''); setQrAge(0)
    setWasenderStatus('idle'); setCreatingPhase(0); setIsLoading(false)
  }, [open])

  // ── Auto-create workspace when entering 'creating' step ───────────────────
  useEffect(() => {
    if (step !== 'creating') return

    const run = async () => {
      try {
        setCreatingPhase(0)
        const workspace = await createWorkspace({
          name: businessName,
          whatsappPhoneNumber: phoneNumber,
          language: lang,
        })

        setCreatingPhase(1)
        const wasResp = await initializeWasenderSession(workspace.id, { phoneNumber })
        setCreatedWorkspaceId(workspace.id)

        if (wasResp.wasenderQrString) {
          setQrString(wasResp.wasenderQrString)
          setWasenderStatus('need_scan')
        } else {
          setWasenderStatus((wasResp.wasenderSessionStatus as any) || 'pending')
        }

        setCreatingPhase(2)
        await new Promise(r => setTimeout(r, 700))
        setStep('qr-scan')
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Failed to create workspace'
        logger.error('[OnboardingWizard] workspace creation failed:', err)
        toast.error(msg)
        setWasenderStatus('failed')
        setStep('qr-scan')
      }
    }
    run()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── QR countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'qr-scan' || !qrString || wasenderStatus === 'connected') return
    const timer = setInterval(() => setQrAge(a => a + 1), 1000)
    return () => clearInterval(timer)
  }, [step, qrString, wasenderStatus])

  // ── Poll wasender status ───────────────────────────────────────────────────
  const pollWasender = useCallback(async () => {
    if (!createdWorkspaceId) return
    try {
      const latest = await getWasenderStatus(createdWorkspaceId)
      const s = (latest.wasenderSessionStatus as any) || 'idle'
      setWasenderStatus(s)
      if (s === 'connected') {
        toast.success('WhatsApp connected successfully!')
        setStep('done')
      }
      if (latest.wasenderQrString && latest.wasenderQrString !== qrString) {
        setQrString(latest.wasenderQrString)
        setQrAge(0)
      }
    } catch {}
  }, [createdWorkspaceId, qrString])

  useEffect(() => {
    if (step !== 'qr-scan' || (wasenderStatus !== 'need_scan' && wasenderStatus !== 'pending')) return
    // Fire an immediate poll so tests and users don't wait for the first interval tick
    pollWasender()
    const interval = setInterval(pollWasender, 3000)
    return () => clearInterval(interval)
  }, [step, wasenderStatus, pollWasender])

  // ──────────────────────────────────────────────────────────────────────────
  //  Handlers
  // ──────────────────────────────────────────────────────────────────────────

  const handleNextBusiness = () => {
    if (!businessName.trim()) { setError(t.errors.required); return }
    setError(''); setStep('channel')
  }

  const handleNextChannel = () => {
    const trimmed = phoneNumber.trim()
    if (!trimmed.startsWith('+') || trimmed.length < 8) { setError(t.errors.phoneFormat); return }
    setError(''); setStep('auth')
  }

  const handleEmailRegister = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError(t.errors.required); return }
    if (!email.trim()) { setError(t.errors.emailRequired); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setError(pwErr); return }
    if (!gdprAccepted) { setError(t.errors.gdprRequired); return }

    setIsLoading(true); setError('')
    try {
      const resp = await api.post('/auth/register', { email, password, firstName, lastName, gdprAccepted: true })
      const { user, qrCode } = resp.data
      setPendingUserId(user.id); setTotpQrCode(qrCode); setIsNewUser(true)
      setStep('totp')
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleAuth = async (credentialResponse: any) => {
    setIsLoading(true); setError('')
    storage.clearAppState()
    try {
      const resp = await api.post('/auth/oauth/google', { credential: credentialResponse.credential })
      const { user, requiresSetup, requires2FA, qrCode, token, sessionId } = resp.data

      // Admin/dev bypass → direct login, skip wizard workspace creation
      if (sessionId && token) {
        storage.setToken(token); storage.setSessionId(sessionId); storage.setUser(user)
        onClose(); navigate('/workspace-selection'); return
      }

      setPendingUserId(user.id)
      if (requiresSetup) { setTotpQrCode(qrCode); setIsNewUser(true) }
      else if (requires2FA) { setIsNewUser(false) }
      setStep('totp')
    } catch (err: any) {
      setError('Google authentication failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyTotp = async () => {
    if (totpCode.length !== 6) { setError(t.errors.invalidCode); return }
    setIsLoading(true); setError('')
    try {
      const endpoint = isNewUser ? '/auth/verify-2fa-setup' : '/auth/verify-2fa'
      const resp = await api.post(endpoint, { userId: pendingUserId, code: totpCode })
      const { token, sessionId, user } = resp.data
      storage.clearAppState()
      storage.setToken(token); storage.setSessionId(sessionId)
      if (user) storage.setUser(user)
      setStep('creating')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerateQr = async () => {
    if (!createdWorkspaceId || isRegeneratingQr) return
    setIsRegeneratingQr(true)
    try {
      const resp = await regenerateWasenderQr(createdWorkspaceId)
      setQrString(resp.wasenderQrString); setQrAge(0); setWasenderStatus('need_scan')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to regenerate QR')
    } finally {
      setIsRegeneratingQr(false)
    }
  }

  const handleDone = () => {
    onClose()
    // Hard reload so axios cache and WorkspaceContext pick up the fresh token + new workspace
    window.location.href = '/workspace-selection'
  }

  // ──────────────────────────────────────────────────────────────────────────
  //  Render
  // ──────────────────────────────────────────────────────────────────────────

  const progress = STEP_PROGRESS[step]
  const qrExpired = qrAge >= QR_EXPIRY

  const renderStep = () => {
    switch (step) {
      case 'business':
        return (
          <div className="space-y-5">
            <div>
              <Label htmlFor="ob-bname">{t.business.name}</Label>
              <Input id="ob-bname" className="mt-1.5" value={businessName}
                onChange={e => { setBusinessName(e.target.value); setError('') }}
                placeholder={t.business.namePh} onKeyDown={e => e.key === 'Enter' && handleNextBusiness()} />
            </div>
            <div>
              <Label>{t.business.industry}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                {INDUSTRIES.map(ind => (
                  <button key={ind} type="button"
                    onClick={() => setIndustry(ind)}
                    className={`px-2 py-2 text-xs rounded-lg border transition-colors text-center ${industry === ind ? 'bg-green-50 border-green-500 text-green-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {t.industries[ind]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 'channel':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ob-phone">{t.channel.phone}</Label>
              <Input id="ob-phone" className="mt-1.5 text-lg tracking-wider" type="tel"
                value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value); setError('') }}
                placeholder={t.channel.phonePh} onKeyDown={e => e.key === 'Enter' && handleNextChannel()} />
              <p className="text-xs text-gray-400 mt-1.5">
                {t.channel.hint}
                <span className="sr-only">International format</span>
              </p>
            </div>
          </div>
        )

      case 'auth':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ob-fn">{t.auth.fname}</Label>
                <Input id="ob-fn" className="mt-1" value={firstName}
                  onChange={e => { setFirstName(e.target.value); setError('') }} />
              </div>
              <div>
                <Label htmlFor="ob-ln">{t.auth.lname}</Label>
                <Input id="ob-ln" className="mt-1" value={lastName}
                  onChange={e => { setLastName(e.target.value); setError('') }} />
              </div>
            </div>
            <div>
              <Label htmlFor="ob-email">{t.auth.email}</Label>
              <Input id="ob-email" type="email" className="mt-1" value={email}
                onChange={e => { setEmail(e.target.value); setError('') }} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="ob-pass">{t.auth.pass}</Label>
              <div className="relative mt-1">
                <Input id="ob-pass" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }} className="pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 pt-1">
              <Checkbox id="ob-gdpr" checked={gdprAccepted}
                onCheckedChange={v => { setGdprAccepted(!!v); setError('') }} />
              <Label htmlFor="ob-gdpr" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                {t.auth.gdpr}
              </Label>
            </div>
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleEmailRegister} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.auth.register}
            </Button>
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">{t.auth.or}</span></div>
            </div>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <div className="flex justify-center">
                <GoogleLogin onSuccess={handleGoogleAuth}
                  onError={() => setError('Google authentication failed')}
                  theme="outline" size="large" text="signup_with" shape="rectangular" logo_alignment="left" />
              </div>
            </GoogleOAuthProvider>
          </div>
        )

      case 'totp':
        return (
          <div className="flex flex-col items-center space-y-5">
            <Shield className="h-10 w-10 text-green-600" />
            {isNewUser && totpQrCode ? (
              <>
                <p className="text-sm text-gray-500 text-center">{t.totp.setupSubtitle}</p>
                <div className="bg-white border-2 border-green-200 rounded-xl p-4 shadow-sm">
                  <QRCode value={totpQrCode} size={180} level="M" />
                </div>
                <p className="text-xs text-gray-400 text-center">{t.totp.setupInstructions}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center">{t.totp.verifySubtitle}</p>
            )}
            <div className="w-full max-w-xs space-y-1.5">
              <Label htmlFor="ob-totp">{t.totp.code}</Label>
              <Input id="ob-totp" className="text-center text-xl tracking-[0.5em] font-mono" maxLength={6}
                value={totpCode} onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleVerifyTotp()} inputMode="numeric" autoFocus />
            </div>
            <Button className="w-full max-w-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleVerifyTotp} disabled={isLoading || totpCode.length !== 6}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t.totp.verify}
            </Button>
          </div>
        )

      case 'creating':
        return (
          <div className="flex flex-col items-center gap-6 py-6">
            <Loader2 className="h-14 w-14 animate-spin text-green-500" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-gray-800">{t.creating.title}</p>
              <p className="text-sm text-gray-500">{t.creating.phases[Math.min(creatingPhase, 2)]}</p>
            </div>
            <div className="w-full max-w-xs bg-gray-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${(creatingPhase + 1) * 33}%` }} />
            </div>
          </div>
        )

      case 'qr-scan':
        return (
          <div className="flex flex-col items-center gap-4">
            <Wifi className="h-8 w-8 text-green-500" />
            {wasenderStatus === 'failed' ? (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">
                  Failed to connect WhatsApp. Please try again from Settings after login.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-sm text-gray-500 text-center">{t.qr.subtitle}</p>
                {qrString && !qrExpired ? (
                  <div className="relative p-4 bg-white border-2 border-green-300 rounded-xl shadow-sm">
                    <QRCode value={qrString} size={210} level="M" />
                    <div className="absolute bottom-2 right-3 text-xs text-gray-400 bg-white/80 rounded px-1">
                      {QR_EXPIRY - qrAge}{t.qr.wait}
                    </div>
                  </div>
                ) : qrExpired ? (
                  <div className="flex flex-col items-center gap-2 p-8 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50">
                    <RefreshCw className="h-7 w-7 text-amber-500" />
                    <p className="text-sm font-medium text-amber-700">{t.qr.expired}</p>
                    <Button size="sm" variant="outline" onClick={handleRegenerateQr} disabled={isRegeneratingQr}>
                      {isRegeneratingQr ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      {t.qr.newQr}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-10 text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Generating QR code...</span>
                  </div>
                )}
                {qrString && !qrExpired && (
                  <Button size="sm" variant="ghost" onClick={handleRegenerateQr} disabled={isRegeneratingQr}
                    className="text-gray-400 text-xs hover:text-gray-600">
                    <RefreshCw className="h-3 w-3 mr-1" />{t.qr.newQr}
                  </Button>
                )}
              </>
            )}
            {wasenderStatus === 'failed' && (
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleDone}>
                Go to Dashboard anyway
              </Button>
            )}
          </div>
        )

      case 'done':
        return (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <PartyPopper className="h-6 w-6 text-amber-400 absolute -top-1 -right-2" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{t.done.title}</p>
              <p className="text-sm text-gray-500 mt-1">{t.done.subtitle}</p>
            </div>
            <Button className="bg-green-600 hover:bg-green-700 text-white px-8" onClick={handleDone}>
              {t.done.cta}
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  const canGoBack = step === 'channel' || step === 'auth'
  const handleBack = () => {
    setError('')
    if (step === 'channel') setStep('business')
    else if (step === 'auth') setStep('channel')
  }

  // Titles for header
  const stepTitles: Record<WizardStep, string> = {
    business: t.business.title,
    channel: t.channel.title,
    auth: t.auth.title,
    totp: t.totp.title,
    creating: t.creating.title,
    'qr-scan': t.qr.title,
    done: t.done.title,
  }
  const stepSubtitles: Record<WizardStep, string> = {
    business: t.business.subtitle,
    channel: t.channel.subtitle,
    auth: t.auth.subtitle,
    totp: isNewUser ? t.totp.setupSubtitle : t.totp.verifySubtitle,
    creating: t.creating.phases[Math.min(creatingPhase, 2)],
    'qr-scan': '',
    done: '',
  }

  const isTransitionStep = step === 'creating' || step === 'qr-scan' || step === 'done'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isTransitionStep) onClose() }}>
      <DialogContent className="w-full h-dvh max-w-none m-0 rounded-none flex flex-col p-0 sm:h-auto sm:max-w-lg sm:m-auto sm:rounded-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 shrink-0">
          <div className="h-full bg-green-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-2 shrink-0">
            {canGoBack && (
              <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-2 transition-colors">
                <ChevronLeft className="h-4 w-4" />{t.back}
              </button>
            )}
            <DialogTitle className="text-xl font-bold text-gray-900">{stepTitles[step]}</DialogTitle>
            {stepSubtitles[step] && step !== 'totp' && (
              <DialogDescription className="text-sm text-gray-500 mt-0.5">{stepSubtitles[step]}</DialogDescription>
            )}
          </DialogHeader>

          {/* Body */}
          <div className="px-6 pb-6 pt-2 flex-1">
            {error && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
              </Alert>
            )}
            {renderStep()}
          </div>

          {/* Footer CTA for simple steps */}
          {(step === 'business' || step === 'channel') && (
            <div className="px-6 pb-6 shrink-0">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={step === 'business' ? handleNextBusiness : handleNextChannel}>
                {t.next}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
