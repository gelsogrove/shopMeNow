/**
 * OnboardingWizardProLoco – short onboarding for /onboarding
 *
 * The generic OnboardingWizardModal asks industry / channel tone / channel
 * type / human-support — questions with one obvious answer for this product
 * (Andrea, 2026-09-15: "/onboarding sarebbe da rivedere tutto perché è
 * destinato alle pro loco"). Every new channel is already forced to
 * channelMode: 'PRO_LOCO' server-side, so those questions were never wired
 * to anything a Pro Loco visitor would actually choose differently.
 *
 * This is a SEPARATE component, not a rewrite of OnboardingWizardModal:
 * that modal is still used by the "Create account" button in the generic
 * login flow (any industry), and changing its questions there would break
 * that funnel. /onboarding alone points here.
 *
 * Flow: business (name + WhatsApp number) → auth (email/password or Google)
 *       → creating → qr-scan (only if WhatsApp requested) → done
 *
 * Reuses the same backend calls as the generic wizard — createWorkspace,
 * /auth/register, /auth/oauth/google, wasender init/sync/regenerate — so a
 * Pro Loco workspace here is created exactly the same way, just without
 * asking questions that already have one answer.
 *
 * customChatbotId is intentionally left unset by createWorkspace: with no
 * override, the workspace resolves to the shared default chatbot rather
 * than any custom module (Andrea, 2026-09-15: "non ha più il concetto di
 * custom ma avrà un chatbot-default cosi tutti puntano lì a parte quelli
 * che obiettivamente hanno un override").
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import QRCode from 'react-qr-code'
import { motion, AnimatePresence } from 'framer-motion'
import { DialogTitle, DialogDescription, DialogPortal } from '@/components/ui/dialog'
import { Dialog } from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Loader2, CheckCircle2, RefreshCw,
  Eye, EyeOff, Wifi, PartyPopper,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '@/services/api'
import { storage } from '@/lib/storage'
import { createWorkspace } from '@/services/workspaceApi'
import { initializeWasenderSession, regenerateWasenderQr, syncWasenderStatus } from '@/services/wasenderApi'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { LanguageSelector } from '@/components/shared/LanguageSelector'
import { logger } from '@/lib/logger'
import { OWT, type OWTLang } from './onboardingWizardTranslations'
import { OWPL } from './onboardingWizardProLocoTranslations'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '988195920488-caj4sdf4t7elrsdedk36a5n5t1ndki4c.apps.googleusercontent.com'
const QR_EXPIRY = 45
const POLL_INTERVAL = import.meta.env.MODE === 'test' ? 50 : 3000

type Step = 'business' | 'auth' | 'creating' | 'qr-scan' | 'done'

interface Props {
  open: boolean
  onClose: () => void
}

const DATA_STEPS: Step[] = ['business', 'auth']
const STEP_PROGRESS: Record<Step, number> = {
  business: 30, auth: 70, creating: 90, 'qr-scan': 96, done: 100,
}
const STEP_IMAGES: Partial<Record<Step, string>> = {
  business: '/survey-agent.png',
  auth: '/survery-secuiry.png',
}
const STEP_ICONS: Partial<Record<Step, string>> = {
  business: '🏢', auth: '👤',
}

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -56 : 56, opacity: 0 }),
}

function validatePassword(p: string): string | null {
  if (p.length < 8) return 'Min 8 characters'
  if (!/[A-Z]/.test(p)) return 'Need at least one uppercase letter'
  if (!/[a-z]/.test(p)) return 'Need at least one lowercase letter'
  if (!/[0-9]/.test(p)) return 'Need at least one number'
  if (!/[^A-Za-z0-9]/.test(p)) return 'Need at least one special character'
  return null
}

export function OnboardingWizardProLoco({ open, onClose }: Props) {
  const { language } = useLanguage()
  const { setCurrentWorkspace } = useWorkspace()
  const lang: OWTLang = (['it', 'en', 'es', 'de', 'fr', 'ca'] as const).includes(language as OWTLang)
    ? (language as OWTLang) : 'en'
  const t = OWT[lang]
  const tpl = OWPL[lang]

  const [step, setStep] = useState<Step>('business')
  const [direction, setDirection] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const goTo = (target: Step, dir: 1 | -1 = 1) => {
    setDirection(dir)
    setError('')
    setStep(target)
  }

  // ── Step data — one screen (name + WhatsApp), no industry/tone/channel-type ──
  const [businessName, setBusinessName] = useState('')
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState('')

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [gdprAccepted, setGdprAccepted] = useState(false)

  // ── Workspace / wasender ──────────────────────────────────────────────────
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState('')
  const [qrString, setQrString] = useState('')
  const [qrAge, setQrAge] = useState(0)
  const [wasenderStatus, setWasenderStatus] = useState<'idle' | 'pending' | 'need_scan' | 'connected' | 'failed'>('idle')
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false)
  const [creatingPhase, setCreatingPhase] = useState(0)
  const isCreatingRef = useRef(false)

  const isTransitionStep = step === 'creating' || step === 'qr-scan' || step === 'done'
  const stepDotIndex = DATA_STEPS.indexOf(step)
  const progress = STEP_PROGRESS[step]
  const needsWhatsApp = whatsappPhoneNumber.trim().length > 0

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setStep('business'); setError(''); setDirection(1)
    setBusinessName(''); setWhatsappPhoneNumber('')
    setEmail(''); setPassword('')
    setShowPassword(false); setGdprAccepted(false)
    setCreatedWorkspaceId(''); setQrString(''); setQrAge(0)
    setWasenderStatus('idle'); setCreatingPhase(0); setIsLoading(false)
    isCreatingRef.current = false
  }, [open])

  // ── Creating: auto-create workspace ──────────────────────────────────────
  useEffect(() => {
    if (step !== 'creating') return
    if (isCreatingRef.current) return
    isCreatingRef.current = true

    const run = async () => {
      try {
        setCreatingPhase(0)
        const workspace = await createWorkspace({
          name: businessName,
          language: lang,
          channelMode: 'PRO_LOCO' as const,
          hasHumanSupport: true,
          enableWhatsapp: needsWhatsApp,
          enableWidget: false,
        })

        setCurrentWorkspace(workspace)
        setCreatingPhase(1)

        let freshQr = ''
        if (needsWhatsApp) {
          const wasResp = await initializeWasenderSession(workspace.id, {
            phoneNumber: whatsappPhoneNumber.trim(),
          })
          setCreatedWorkspaceId(workspace.id)
          if (wasResp.wasenderQrString) {
            freshQr = wasResp.wasenderQrString
            setQrString(wasResp.wasenderQrString)
            setWasenderStatus('need_scan')
          } else {
            setWasenderStatus((wasResp.wasenderSessionStatus as any) || 'pending')
          }
        } else {
          setCreatedWorkspaceId(workspace.id)
        }

        setCreatingPhase(2)
        await new Promise(r => setTimeout(r, 700))

        goTo(needsWhatsApp && freshQr ? 'qr-scan' : 'done')
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Failed to create workspace'
        logger.error('[OnboardingWizardProLoco] workspace creation failed:', err)
        toast.error(msg)
        setWasenderStatus('failed')
        goTo('done')
      }
    }
    run()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── QR countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'qr-scan' || !qrString || wasenderStatus === 'connected') return
    setQrAge(0)
    const timer = setInterval(() => setQrAge(a => a + 1), 1000)
    return () => clearInterval(timer)
  }, [step, qrString, wasenderStatus])

  // ── Sync status once when entering QR step ───────────────────────────────
  useEffect(() => {
    if (step !== 'qr-scan' || !createdWorkspaceId) return
    let cancelled = false
    const sync = async () => {
      try {
        const latest = await syncWasenderStatus(createdWorkspaceId)
        if (cancelled) return
        if (latest.wasenderSessionStatus) {
          const s = (latest.wasenderSessionStatus as any) || 'idle'
          setWasenderStatus(s)
          if (s === 'connected') {
            toast.success('WhatsApp connected successfully!')
            goTo('done')
          }
        }
      } catch (err) {
        logger.error('[OnboardingWizardProLoco] status sync failed:', err)
      }
    }
    sync()
    return () => { cancelled = true }
  }, [step, createdWorkspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll status while on qr-scan ──────────────────────────────────────────
  const pollWasender = useCallback(async () => {
    if (!createdWorkspaceId) return
    try {
      const latest = await syncWasenderStatus(createdWorkspaceId)
      const s = (latest.wasenderSessionStatus as any) || 'idle'
      setWasenderStatus(s)
      if (s === 'connected') {
        toast.success('WhatsApp connected successfully!')
        goTo('done')
      }
    } catch (err) {
      logger.error('[OnboardingWizardProLoco] poll failed:', err)
    }
  }, [createdWorkspaceId])

  useEffect(() => {
    if (step !== 'qr-scan') return
    const interval = setInterval(pollWasender, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [step, pollWasender])

  const qrExpired = qrAge >= QR_EXPIRY

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNextBusiness = () => {
    if (!businessName.trim()) { setError(tpl.errors.nameRequired); return }
    if (whatsappPhoneNumber.trim() && !whatsappPhoneNumber.trim().startsWith('+')) {
      setError(tpl.errors.phoneFormat)
      return
    }
    goTo('auth')
  }

  const handleEmailRegister = async () => {
    if (!email.trim()) { setError(t.errors.emailRequired); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setError(pwErr); return }
    if (!gdprAccepted) { setError(t.errors.gdprRequired); return }

    setIsLoading(true); setError('')
    try {
      const resp = await api.post('/auth/register', { email, password, gdprAccepted: true, skipSetup: true })
      const { token, sessionId, user } = resp.data
      storage.clearAppState()
      storage.setToken(token); storage.setSessionId(sessionId)
      if (user) storage.setUser(user)
      goTo('creating')
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
      const resp = await api.post('/auth/oauth/google', { credential: credentialResponse.credential, skipSetup: true })
      const { user, token, sessionId } = resp.data
      if (sessionId && token) {
        storage.setToken(token); storage.setSessionId(sessionId)
        if (user) storage.setUser(user)
        goTo('creating')
        return
      }
    } catch {
      setError('Google authentication failed. Please try again.')
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
    window.location.href = '/workspace-selection'
  }

  const handleBack = () => {
    if (step === 'auth') goTo('business', -1)
  }
  const canGoBack = step === 'auth'

  const bannerTitle = step === 'business' ? tpl.business.title : step === 'auth' ? t.auth.title : ''
  const stepImage = STEP_IMAGES[step]

  const renderStepContent = () => {
    switch (step) {
      case 'business':
        return (
          <div className="space-y-5">
            <p className="text-slate-500" style={{ fontSize: '1.05rem' }}>{tpl.business.subtitle}</p>
            <div>
              <Label htmlFor="obpl-bname">{tpl.business.name}</Label>
              <Input
                id="obpl-bname"
                className="mt-1.5 text-base"
                value={businessName}
                onChange={e => { setBusinessName(e.target.value); setError('') }}
                placeholder={tpl.business.namePh}
                onKeyDown={e => e.key === 'Enter' && handleNextBusiness()}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="obpl-phone" className="text-xs font-medium text-slate-600">{tpl.business.phone}</Label>
              <Input
                id="obpl-phone"
                type="tel"
                className="mt-1.5 text-base"
                value={whatsappPhoneNumber}
                onChange={e => { setWhatsappPhoneNumber(e.target.value); setError('') }}
                placeholder="+393331234567"
              />
              <p className="text-[11px] text-slate-400 mt-1">{tpl.business.phoneHint}</p>
            </div>
          </div>
        )

      case 'auth':
        return (
          <div className="space-y-3">
            <p className="text-slate-500 text-sm">{t.auth.subtitle}</p>
            <div>
              <Label htmlFor="obpl-email" className="text-xs font-medium text-slate-600">{t.auth.email}</Label>
              <Input id="obpl-email" type="email" className="mt-1 h-9 text-sm" value={email}
                onChange={e => { setEmail(e.target.value); setError('') }} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="obpl-pass" className="text-xs font-medium text-slate-600">{t.auth.pass}</Label>
              <div className="relative mt-1">
                <Input id="obpl-pass" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }} className="pr-10 h-9 text-sm" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Min 8 chars, uppercase, lowercase, number, special character</p>
            </div>
            <div className="flex items-start gap-2 pt-0.5">
              <Checkbox id="obpl-gdpr" checked={gdprAccepted}
                onCheckedChange={v => { setGdprAccepted(!!v); setError('') }} />
              <label htmlFor="obpl-gdpr" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                {lang === 'it' && <>Accetto i{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Termini di Servizio</a>
                  {' '}e la{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Privacy Policy</a>
                </>}
                {lang === 'es' && <>Acepto los{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Términos de Servicio</a>
                  {' '}y la{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Política de Privacidad</a>
                </>}
                {lang === 'de' && <>Ich akzeptiere die{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Nutzungsbedingungen</a>
                  {' '}und die{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Datenschutzerklärung</a>
                </>}
                {(lang === 'en' || !['it', 'es', 'de'].includes(lang)) && <>I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Privacy Policy</a>
                </>}
              </label>
            </div>
            <div className="relative pt-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-gray-400">{t.auth.or}</span>
              </div>
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

      case 'creating':
        return (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-gray-800">{t.creating.title}</p>
              <p className="text-sm text-gray-500">{t.creating.phasesWhatsapp[Math.min(creatingPhase, 2)]}</p>
            </div>
            <div className="w-full max-w-xs bg-gray-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${(creatingPhase + 1) * 33}%` }} />
            </div>
          </div>
        )

      case 'qr-scan':
        return (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Wifi className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{t.qr.title}</h2>
            {wasenderStatus === 'failed' ? (
              <>
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700 text-sm">
                    Failed to connect WhatsApp. You can configure it from Settings after login.
                  </AlertDescription>
                </Alert>
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleDone}>
                  Go to Dashboard anyway
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 text-center">{t.qr.subtitle}</p>
                {qrString && !qrExpired ? (
                  <div className="relative p-4 bg-white border-2 border-green-300 rounded-xl shadow-sm">
                    <QRCode value={qrString} size={Math.min(210, window.innerWidth - 120)} level="M" />
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
                <button
                  type="button"
                  onClick={handleDone}
                  className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
                >
                  {t.qr.later}
                </button>
              </>
            )}
          </div>
        )

      case 'done':
        return (
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-11 w-11 text-green-600" />
              </div>
              <PartyPopper className="h-7 w-7 text-amber-400 absolute -top-1 -right-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{t.done.title}</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{t.done.subtitleWhatsapp}</p>
            </div>
            <Button className="bg-green-600 hover:bg-green-700 text-white px-10 py-2.5 rounded-xl" onClick={handleDone}>
              {t.done.cta}
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isTransitionStep) onClose() }}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto outline-none">
          <DialogTitle className="sr-only">eChatbot Setup — Pro Loco</DialogTitle>
          <DialogDescription className="sr-only">Onboarding for tourist offices</DialogDescription>

          <div
            className="min-h-full flex flex-col"
            style={{ background: 'linear-gradient(135deg, rgba(248,250,252,0.97) 0%, rgba(236,253,245,0.95) 50%, rgba(240,253,244,0.97) 100%)' }}
          >
            {/* Dark header, same surface as the Pro Loco landing page's own
                header — a white bar with a small green wordmark read as a
                different, less finished product next to it (Andrea,
                2026-09-15: "il logo e' diverseo... header non e' colorata"). */}
            <header className="bg-[#070d18]/90 backdrop-blur border-b border-white/10 shadow-sm sticky top-0 z-50 shrink-0">
              <div className="max-w-[727px] mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
                <button onClick={onClose} className="flex items-center gap-1 shrink-0 hover:opacity-80 transition-opacity">
                  <span className="font-display font-bold tracking-tight" style={{ color: '#25D366', fontSize: 24 }}>
                    eChatbot<span className="text-white">.AI</span>
                  </span>
                </button>
                <div className="flex items-center gap-3">
                  <LanguageSelector />
                </div>
              </div>
            </header>

            <div className="flex-1 flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
              <div className="w-full max-w-[727px]">
                {isTransitionStep ? (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden"
                  >
                    <div className="p-6 sm:p-10">
                      {renderStepContent()}
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="h-1 bg-slate-100">
                      <motion.div
                        className="h-full bg-green-500"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    {stepDotIndex >= 0 && (
                      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Step {stepDotIndex + 1} of {DATA_STEPS.length}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {DATA_STEPS.map((_, i) => (
                              <div
                                key={i}
                                className={[
                                  'h-1.5 rounded-full transition-all duration-300',
                                  i < stepDotIndex ? 'w-5 bg-green-500' :
                                  i === stepDotIndex ? 'w-7 bg-green-500' :
                                  'w-5 bg-slate-200',
                                ].join(' ')}
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Close"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {stepImage ? (
                      <img
                        src={stepImage}
                        alt=""
                        className={`w-full object-cover object-center ${step === 'auth' ? 'h-24 sm:h-28' : 'h-36 sm:h-44'}`}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className={`w-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center ${step === 'auth' ? 'h-24 sm:h-28' : 'h-36 sm:h-44'}`}>
                        <span className="text-4xl opacity-20">🖼️</span>
                      </div>
                    )}

                    <div className="px-4 sm:px-6 pt-4 pb-4 sm:pb-5">
                      {bannerTitle && (
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">{STEP_ICONS[step]}</span>
                          <h2 className="text-xl font-bold text-slate-900">{bannerTitle}</h2>
                        </div>
                      )}

                      {error && (
                        <Alert className="mb-4 border-red-200 bg-red-50">
                          <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
                        </Alert>
                      )}

                      <div>
                        <AnimatePresence mode="wait" custom={direction}>
                          <motion.div
                            key={step}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                          >
                            {renderStepContent()}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                        <div>
                          {canGoBack && (
                            <Button
                              variant="outline"
                              onClick={handleBack}
                              className="px-6 border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              ← {t.back}
                            </Button>
                          )}
                        </div>
                        <div>
                          {step === 'business' && (
                            <Button className="px-6 bg-green-600 hover:bg-green-700 text-white" onClick={handleNextBusiness}>
                              {t.next} →
                            </Button>
                          )}
                          {step === 'auth' && (
                            <Button className="px-6 bg-green-600 hover:bg-green-700 text-white" onClick={handleEmailRegister} disabled={isLoading}>
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              {t.auth.register} →
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
