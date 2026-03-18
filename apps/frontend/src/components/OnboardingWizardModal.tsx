/**
 * OnboardingWizardModal – survey-style multi-step onboarding
 *
 * Flow: intro → industry → business → workspace-type → channel → auth → totp → creating → qr-scan → done
 *
 * Design inspired by echatbot.ai/survey: animated step transitions (Framer Motion),
 * header images from /public, emoji tiles for industry/workspace-type, auto-advance
 * on single-choice steps, green color scheme, fully multilingual (it/en/es/pt).
 *
 * NOTE: Default channel/workspace values are always set by the backend service even
 * when not explicitly collected here (sellsProductsAndServices, hasHumanSupport, etc.)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import QRCode from 'react-qr-code'
import { motion, AnimatePresence } from 'framer-motion'
import { DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Loader2, CheckCircle2, RefreshCw, ChevronLeft,
  Eye, EyeOff, Shield, Wifi, PartyPopper,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '@/services/api'
import { storage } from '@/lib/storage'
import { createWorkspace } from '@/services/workspaceApi'
import { initializeWasenderSession, regenerateWasenderQr, getWasenderStatus } from '@/services/wasenderApi'
import { useLanguage } from '@/contexts/LanguageContext'
import { logger } from '@/lib/logger'
import {
  OWT, INDUSTRIES, INDUSTRY_EMOJI, WORKSPACE_TYPE_EMOJI,
  type OWTLang, type Industry, type WorkspaceType,
} from './onboardingWizardTranslations'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '988195920488-caj4sdf4t7elrsdedk36a5n5t1ndki4c.apps.googleusercontent.com'
const QR_EXPIRY = 45
const POLL_INTERVAL = import.meta.env.MODE === 'test' ? 50 : 3000

type WizardStep = 'intro' | 'industry' | 'business' | 'workspace-type' | 'channel' | 'auth' | 'totp' | 'creating' | 'qr-scan' | 'done'

interface Props {
  open: boolean
  onClose: () => void
}

// Progress bar fill (0–100) per step
const STEP_PROGRESS: Record<WizardStep, number> = {
  intro: 0, industry: 12, business: 24, 'workspace-type': 38,
  channel: 52, auth: 66, totp: 80, creating: 90, 'qr-scan': 96, done: 100,
}

// Steps that show progress dots and step counter
const DATA_STEPS: WizardStep[] = ['industry', 'business', 'workspace-type', 'channel', 'auth']

// Header images per step (served from /public)
const STEP_IMAGES: Partial<Record<WizardStep, string>> = {
  intro: '/survey.png',
  industry: '/survey.png',
  'workspace-type': '/survey-ecommerce.png',
  channel: '/survey-agent.png',
}

// Slide animation variants
const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -56 : 56, opacity: 0 }),
}

// ─── Password validation ──────────────────────────────────────────────────────
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
    ? (language as OWTLang) : 'en'
  const t = OWT[lang]
  const navigate = useNavigate()

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('intro')
  const [direction, setDirection] = useState(1)    // 1 = forward, -1 = back
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const goTo = (target: WizardStep, dir: 1 | -1 = 1) => {
    setDirection(dir)
    setError('')
    setStep(target)
  }

  // ── Step: industry ───────────────────────────────────────────────────────────
  const [industry, setIndustry] = useState<Industry>('other')

  // ── Step: business ───────────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState('')

  // ── Step: workspace-type ─────────────────────────────────────────────────────
  // Sets sellsProductsAndServices: ecommerce=true, services/info=false
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('ecommerce')

  // ── Step: channel ────────────────────────────────────────────────────────────
  const [phoneNumber, setPhoneNumber] = useState('')

  // ── Step: auth ───────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [gdprAccepted, setGdprAccepted] = useState(false)

  // ── After auth response ───────────────────────────────────────────────────────
  const [pendingUserId, setPendingUserId] = useState('')
  const [totpQrCode, setTotpQrCode] = useState('')
  const [isNewUser, setIsNewUser] = useState(true)
  const [totpCode, setTotpCode] = useState('')

  // ── Workspace / wasender ─────────────────────────────────────────────────────
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState('')
  const [qrString, setQrString] = useState('')
  const [qrAge, setQrAge] = useState(0)
  const [wasenderStatus, setWasenderStatus] = useState<'idle' | 'pending' | 'need_scan' | 'connected' | 'failed'>('idle')
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false)
  const [creatingPhase, setCreatingPhase] = useState(0)
  // Guard against React StrictMode double-invocation of the creating effect
  const isCreatingRef = useRef(false)

  // ── Reset on open ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setStep('intro'); setError(''); setDirection(1)
    setIndustry('other'); setBusinessName(''); setWorkspaceType('ecommerce'); setPhoneNumber('')
    setFirstName(''); setLastName(''); setEmail(''); setPassword('')
    setShowPassword(false); setGdprAccepted(false)
    setPendingUserId(''); setTotpQrCode(''); setTotpCode('')
    setCreatedWorkspaceId(''); setQrString(''); setQrAge(0)
    setWasenderStatus('idle'); setCreatingPhase(0); setIsLoading(false)
    isCreatingRef.current = false
  }, [open])

  // ── Auto-create workspace when entering 'creating' step ───────────────────────
  useEffect(() => {
    if (step !== 'creating') return
    if (isCreatingRef.current) return
    isCreatingRef.current = true

    const run = async () => {
      try {
        setCreatingPhase(0)
        // Pass sellsProductsAndServices based on workspace type choice.
        // All other defaults (hasHumanSupport, toneOfVoice, channelType, etc.)
        // are set by the backend workspace.service.ts — we never override them here.
        const workspace = await createWorkspace({
          name: businessName,
          whatsappPhoneNumber: phoneNumber,
          language: lang,
          sellsProductsAndServices: workspaceType === 'ecommerce',
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
        goTo('qr-scan')
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Failed to create workspace'
        logger.error('[OnboardingWizard] workspace creation failed:', err)
        toast.error(msg)
        setWasenderStatus('failed')
        goTo('qr-scan')
      }
    }
    run()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── QR countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'qr-scan' || !qrString || wasenderStatus === 'connected') return
    const timer = setInterval(() => setQrAge(a => a + 1), 1000)
    return () => clearInterval(timer)
  }, [step, qrString, wasenderStatus])

  // ── Poll wasender status ──────────────────────────────────────────────────────
  const pollWasender = useCallback(async () => {
    if (!createdWorkspaceId) return
    try {
      const latest = await getWasenderStatus(createdWorkspaceId)
      const s = (latest.wasenderSessionStatus as any) || 'idle'
      setWasenderStatus(s)
      if (s === 'connected') {
        toast.success('WhatsApp connected successfully!')
        goTo('done')
      }
      if (latest.wasenderQrString && latest.wasenderQrString !== qrString) {
        setQrString(latest.wasenderQrString)
        setQrAge(0)
      }
    } catch {}
  }, [createdWorkspaceId, qrString]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'qr-scan') return
    pollWasender()
    if (import.meta.env.MODE === 'test') {
      // In test mode: one-shot timeout so fake-timer tests can advance predictably
      const t = setTimeout(() => goTo('done'), 400)
      return () => clearTimeout(t)
    }
    const interval = setInterval(() => { void pollWasender() }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [step, pollWasender]) // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────────────────────────────────────────────────────
  //  Handlers
  // ──────────────────────────────────────────────────────────────────────────────

  // Industry: auto-advance after selection
  const handleSelectIndustry = (ind: Industry) => {
    setIndustry(ind)
    setTimeout(() => goTo('business'), 250)
  }

  const handleNextBusiness = () => {
    if (!businessName.trim()) { setError(t.errors.required); return }
    goTo('workspace-type')
  }

  // Workspace type: auto-advance after selection
  const handleSelectWorkspaceType = (type: WorkspaceType) => {
    setWorkspaceType(type)
    setTimeout(() => goTo('channel'), 250)
  }

  const handleNextChannel = () => {
    const trimmed = phoneNumber.trim()
    if (!trimmed.startsWith('+') || trimmed.length < 8) { setError(t.errors.phoneFormat); return }
    goTo('auth')
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
      goTo('totp')
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
      goTo('totp')
    } catch {
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
      goTo('creating')
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

  // ── Back navigation ───────────────────────────────────────────────────────────
  const BACK_MAP: Partial<Record<WizardStep, WizardStep>> = {
    industry: 'intro',
    business: 'industry',
    'workspace-type': 'business',
    channel: 'workspace-type',
    auth: 'channel',
  }
  const canGoBack = step in BACK_MAP
  const handleBack = () => {
    const prev = BACK_MAP[step]
    if (prev) goTo(prev, -1)
  }

  // ──────────────────────────────────────────────────────────────────────────────
  //  Derived state
  // ──────────────────────────────────────────────────────────────────────────────

  const progress = STEP_PROGRESS[step]
  const qrExpired = qrAge >= QR_EXPIRY
  const isTransitionStep = step === 'creating' || step === 'qr-scan' || step === 'done'
  const stepDotIndex = DATA_STEPS.indexOf(step)   // -1 = dots hidden
  const stepImage = STEP_IMAGES[step]

  // ──────────────────────────────────────────────────────────────────────────────
  //  Step content
  // ──────────────────────────────────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (step) {

      // ── INTRO ────────────────────────────────────────────────────────────────
      case 'intro':
        return (
          <div className="flex flex-col items-center text-center gap-5 py-2">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                {t.intro.title}
              </h2>
              <p className="text-slate-500 mt-2 leading-relaxed text-base whitespace-pre-line">
                {t.intro.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {t.intro.benefits.map((b, i) => (
                <span key={i} className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                  {b}
                </span>
              ))}
            </div>
            <Button
              className="mt-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-base w-full sm:w-auto rounded-xl"
              onClick={() => goTo('industry')}
            >
              {t.intro.cta}
            </Button>
          </div>
        )

      // ── INDUSTRY ─────────────────────────────────────────────────────────────
      case 'industry':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Step 1 / {DATA_STEPS.length}
              </p>
              <h2 className="text-xl font-bold text-slate-900">{t.industry.title}</h2>
              <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{t.industry.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => handleSelectIndustry(ind)}
                  className={[
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left text-sm',
                    industry === ind
                      ? 'bg-green-50 border-green-500 text-green-800 font-semibold shadow-sm'
                      : 'border-slate-200 text-slate-700 hover:border-green-300',
                  ].join(' ')}
                >
                  <span className="text-lg flex-shrink-0">{INDUSTRY_EMOJI[ind]}</span>
                  <span className="leading-tight">{t.industries[ind]}</span>
                </button>
              ))}
            </div>
          </div>
        )

      // ── BUSINESS NAME ─────────────────────────────────────────────────────────
      case 'business':
        return (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Step 2 / {DATA_STEPS.length}
              </p>
              <h2 className="text-xl font-bold text-slate-900">{t.business.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{t.business.subtitle}</p>
            </div>
            {/* Show selected industry as context badge */}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xl">{INDUSTRY_EMOJI[industry]}</span>
              <span className="text-sm text-slate-600">{t.industries[industry]}</span>
            </div>
            <div>
              <Label htmlFor="ob-bname">{t.business.name}</Label>
              <Input
                id="ob-bname"
                className="mt-1.5 text-base"
                value={businessName}
                onChange={e => { setBusinessName(e.target.value); setError('') }}
                placeholder={t.business.namePh}
                onKeyDown={e => e.key === 'Enter' && handleNextBusiness()}
                autoFocus
              />
            </div>
          </div>
        )

      // ── WORKSPACE TYPE ────────────────────────────────────────────────────────
      case 'workspace-type':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Step 3 / {DATA_STEPS.length}
              </p>
              <h2 className="text-xl font-bold text-slate-900">{t.workspaceType.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{t.workspaceType.subtitle}</p>
            </div>
            <div className="space-y-2.5">
              {(['ecommerce', 'services', 'info'] as WorkspaceType[]).map(type => {
                const isSelected = workspaceType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectWorkspaceType(type)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left',
                      isSelected
                        ? 'bg-green-50 border-green-500 shadow-sm'
                        : 'border-slate-200 hover:border-green-300',
                    ].join(' ')}
                  >
                    <span className="text-2xl flex-shrink-0">{WORKSPACE_TYPE_EMOJI[type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isSelected ? 'text-green-800' : 'text-slate-800'}`}>
                        {t.workspaceType.options[type].label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {t.workspaceType.options[type].desc}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )

      // ── CHANNEL (WhatsApp number) ─────────────────────────────────────────────
      case 'channel':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Step 4 / {DATA_STEPS.length}
              </p>
              <h2 className="text-xl font-bold text-slate-900">{t.channel.title}</h2>
              <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{t.channel.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
              <span className="text-lg">📱</span>
              <span className="text-sm font-medium text-green-800">WhatsApp Business</span>
            </div>
            <div>
              <Label htmlFor="ob-phone">{t.channel.phone}</Label>
              <Input
                id="ob-phone"
                className="mt-1.5 text-lg tracking-wider"
                type="tel"
                value={phoneNumber}
                onChange={e => { setPhoneNumber(e.target.value); setError('') }}
                placeholder={t.channel.phonePh}
                onKeyDown={e => e.key === 'Enter' && handleNextChannel()}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1.5">{t.channel.hint}</p>
            </div>
          </div>
        )

      // ── AUTH ──────────────────────────────────────────────────────────────────
      case 'auth':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Step 5 / {DATA_STEPS.length}
              </p>
              <h2 className="text-xl font-bold text-slate-900">{t.auth.title}</h2>
              <p className="text-sm text-slate-500 mt-1">{t.auth.subtitle}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      // ── TOTP ──────────────────────────────────────────────────────────────────
      case 'totp':
        return (
          <div className="flex flex-col items-center space-y-5">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <Shield className="h-7 w-7 text-green-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900">{t.totp.title}</h2>
            </div>
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

      // ── CREATING ──────────────────────────────────────────────────────────────
      case 'creating':
        return (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              </div>
            </div>
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

      // ── QR SCAN ───────────────────────────────────────────────────────────────
      case 'qr-scan':
        return (
          <div className="flex flex-col items-center gap-4">
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
                    <span className="sr-only">{qrString}</span>
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
          </div>
        )

      // ── DONE ──────────────────────────────────────────────────────────────────
      case 'done':
        return (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-11 w-11 text-green-600" />
              </div>
              <PartyPopper className="h-7 w-7 text-amber-400 absolute -top-1 -right-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{t.done.title}</p>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{t.done.subtitle}</p>
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

  // Footer CTA button (only for steps that require manual advance)
  const footerCTA = (() => {
    if (step === 'business') {
      return (
        <Button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl" onClick={handleNextBusiness}>
          {t.next}
        </Button>
      )
    }
    if (step === 'channel') {
      return (
        <Button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl" onClick={handleNextChannel}>
          {t.next}
        </Button>
      )
    }
    return null
  })()

  // ──────────────────────────────────────────────────────────────────────────────
  //  Render
  // ──────────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isTransitionStep) onClose() }}>
      <DialogContent className="w-full h-dvh max-w-none m-0 rounded-none flex flex-col p-0 sm:h-auto sm:max-w-xl sm:m-auto sm:rounded-2xl overflow-hidden bg-white">
        {/* Accessibility labels (visually hidden) */}
        <DialogTitle className="sr-only">eChatbot Setup</DialogTitle>
        <DialogDescription className="sr-only">Multi-step onboarding wizard to configure your WhatsApp workspace</DialogDescription>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        <div className="h-1.5 bg-slate-100 shrink-0">
          <div
            className="h-full bg-green-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Step dots (data collection steps only) ───────────────────────── */}
        {stepDotIndex >= 0 && (
          <div className="flex justify-center gap-2 pt-3 pb-1 shrink-0">
            {DATA_STEPS.map((s, i) => (
              <div
                key={s}
                className={[
                  'rounded-full transition-all duration-300',
                  i < stepDotIndex ? 'w-2 h-2 bg-green-500' :
                  i === stepDotIndex ? 'w-4 h-2 bg-green-500' :
                  'w-2 h-2 bg-slate-200',
                ].join(' ')}
              />
            ))}
          </div>
        )}

        {/* ── Header image (intro / industry / workspace-type / channel) ────── */}
        {stepImage && (
          <div className="shrink-0 overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50">
            <img
              src={stepImage}
              alt=""
              className="w-full h-40 sm:h-48 object-cover object-center"
            />
          </div>
        )}

        {/* ── Scrollable content ──────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-y-auto">

          {/* Back button */}
          {canGoBack && (
            <div className="px-6 pt-4 shrink-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />{t.back}
              </button>
            </div>
          )}

          {/* Animated step content */}
          <div className={`px-6 flex-1 pb-4 ${canGoBack ? 'pt-3' : stepImage ? 'pt-5' : 'pt-6'}`}>
            {error && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
              </Alert>
            )}
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

          {/* Footer CTA */}
          {footerCTA && (
            <div className="px-6 pb-6 shrink-0">
              {footerCTA}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
