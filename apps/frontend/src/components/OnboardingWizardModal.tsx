/**
 * OnboardingWizardModal – survey-style multi-step onboarding
 *
 * Flow:
 *   industry → business → channel-personality → workspace-type →
 *   channel-type → human-support →
 *   auth → creating →
 *   [qr-scan — only if whatsapp or both] →
 *   done
 *
 * Note: TOTP/2FA is deferred — users configure it from profile settings after onboarding
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
  Eye, EyeOff, Shield, Wifi, PartyPopper,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '@/services/api'
import { storage } from '@/lib/storage'
import { createWorkspace } from '@/services/workspaceApi'
import { initializeWasenderSession, regenerateWasenderQr, getWasenderStatus, syncWasenderStatus } from '@/services/wasenderApi'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { LanguageSelector } from '@/components/shared/LanguageSelector'
import { logger } from '@/lib/logger'
import {
  OWT, INDUSTRIES, INDUSTRY_EMOJI, WORKSPACE_TYPE_EMOJI, TONE_OPTIONS,
  type OWTLang, type Industry, type WorkspaceType, type ChannelTone,
} from './onboardingWizardTranslations'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '988195920488-caj4sdf4t7elrsdedk36a5n5t1ndki4c.apps.googleusercontent.com'
const QR_EXPIRY = 45
const POLL_INTERVAL = import.meta.env.MODE === 'test' ? 50 : 3000

type ChannelChoice = 'whatsapp' | 'widget' | 'both'
type WizardStep = 'industry' | 'business' | 'channel-personality' | 'workspace-type' | 'channel-type' | 'human-support' | 'auth' | 'totp' | 'creating' | 'qr-scan' | 'done'

interface Props {
  open: boolean
  onClose: () => void
}

// Data steps (shown in step counter) — 7 steps total
const DATA_STEPS: WizardStep[] = ['industry', 'business', 'channel-personality', 'workspace-type', 'channel-type', 'human-support', 'auth']

// Progress bar fill (0–100) per step
const STEP_PROGRESS: Record<WizardStep, number> = {
  industry: 8, business: 22, 'channel-personality': 36,
  'workspace-type': 50, 'channel-type': 64, 'human-support': 78, auth: 88,
  totp: 92, creating: 96, 'qr-scan': 98, done: 100,
}

// Full-bleed image per step
const STEP_IMAGES: Partial<Record<WizardStep, string>> = {
  industry: '/survey.png',
  business: '/survey-agent.png',
  'channel-personality': '/survery-crm.png',
  'workspace-type': '/survey-ecommerce.png',
  'channel-type': '/surver-widget.png',
  'human-support': '/survey-support.png',
  auth: '/survery-secuiry.png',
}

// Icon per step (shown below photo)
const STEP_ICONS: Partial<Record<WizardStep, string>> = {
  industry: '🏢', business: '✏️', 'channel-personality': '🎭',
  'workspace-type': '🚀', 'channel-type': '📱', 'human-support': '🤝', auth: '👤',
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

export function OnboardingWizardModal({ open, onClose }: Props) {
  const { language } = useLanguage()
  const { setCurrentWorkspace } = useWorkspace()
  const lang: OWTLang = (['it', 'en', 'es', 'pt'] as const).includes(language as OWTLang)
    ? (language as OWTLang) : 'en'
  const t = OWT[lang]
  const navigate = useNavigate()

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('industry')
  const [direction, setDirection] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const goTo = (target: WizardStep, dir: 1 | -1 = 1) => {
    setDirection(dir)
    setError('')
    setStep(target)
  }

  // ── Step data ────────────────────────────────────────────────────────────────
  const [industry, setIndustry] = useState<Industry>('other')
  const [businessName, setBusinessName] = useState('')
  const [botName, setBotName] = useState('')
  const [channelTone, setChannelTone] = useState<ChannelTone>('friendly')
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('ecommerce')
  const [channelChoice, setChannelChoice] = useState<ChannelChoice>('whatsapp')
  const [hasHumanSupport, setHasHumanSupport] = useState(true)
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState('')

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [gdprAccepted, setGdprAccepted] = useState(false)
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
  const isCreatingRef = useRef(false)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const needsWhatsApp = channelChoice === 'whatsapp' || channelChoice === 'both'
  const needsWidget = channelChoice === 'widget' || channelChoice === 'both'
  const isTransitionStep = step === 'creating' || step === 'qr-scan' || step === 'done'
  const stepDotIndex = DATA_STEPS.indexOf(step)
  const progress = STEP_PROGRESS[step]

  // ── Reset on open ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setStep('industry'); setError(''); setDirection(1)
    setIndustry('other'); setBusinessName(''); setBotName(''); setChannelTone('friendly')
    setWorkspaceType('ecommerce'); setChannelChoice('whatsapp'); setHasHumanSupport(true)
    setWhatsappPhoneNumber('')
    setEmail(''); setPassword('')
    setShowPassword(false); setGdprAccepted(false)
    setPendingUserId(''); setTotpQrCode(''); setTotpCode('')
    setCreatedWorkspaceId(''); setQrString(''); setQrAge(0)
    setWasenderStatus('idle'); setCreatingPhase(0); setIsLoading(false)
    isCreatingRef.current = false
  }, [open])

  // ── Creating: auto-create workspace ──────────────────────────────────────────
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
          sellsProductsAndServices: workspaceType === 'ecommerce',
          hasHumanSupport,
          enableWhatsapp: needsWhatsApp,
          enableWidget: needsWidget,
        })

        // Immediately persist workspace so subsequent calls (headers, context) use it
        setCurrentWorkspace(workspace)

        setCreatingPhase(1)

        if (needsWhatsApp) {
          const wasResp = await initializeWasenderSession(workspace.id, {
            phoneNumber: whatsappPhoneNumber.trim(),
          })
          setCreatedWorkspaceId(workspace.id)
          if (wasResp.wasenderQrString) {
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

        if (needsWhatsApp) {
          goTo('qr-scan')
        } else {
          goTo('done')
        }
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
    console.log('[QR DEBUG] Starting QR countdown. QR string:', qrString.substring(0, 20) + '...', 'Status:', wasenderStatus)
    setQrAge(0)
    const timer = setInterval(() => setQrAge(a => {
      const newAge = a + 1
      if (newAge % 5 === 0) console.log('[QR DEBUG] QR age:', newAge, '/', QR_EXPIRY, 'seconds')
      return newAge
    }), 1000)
    return () => {
      console.log('[QR DEBUG] Stopping QR countdown')
      clearInterval(timer)
    }
  }, [step, qrString, wasenderStatus])

  // ── Sync status once when entering QR step (fallback if webhook missing) ───────
  useEffect(() => {
    if (step !== 'qr-scan' || !createdWorkspaceId) return
    console.log('[QR DEBUG] Syncing Wasender status for workspace:', createdWorkspaceId)
    let cancelled = false
    const sync = async () => {
      try {
        const latest = await syncWasenderStatus(createdWorkspaceId)
        if (cancelled) return
        console.log('[QR DEBUG] Sync result:', { 
          status: latest.wasenderSessionStatus, 
          hasQr: !!latest.wasenderQrString,
          qrChanged: latest.wasenderQrString !== qrString 
        })
        if (latest.wasenderSessionStatus) {
          const s = (latest.wasenderSessionStatus as any) || 'idle'
          setWasenderStatus(s)
          if (s === 'connected') {
            toast.success('WhatsApp connected successfully!')
            goTo('done')
            return
          }
        }
        if (latest.wasenderQrString && latest.wasenderQrString !== qrString) {
          console.log('[QR DEBUG] QR code updated from sync')
          setQrString(latest.wasenderQrString)
          setQrAge(0)
        }
      } catch (err) {
        console.error('[QR DEBUG] Sync failed:', err)
      }
    }
    sync()
    return () => { cancelled = true }
  }, [step, createdWorkspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll wasender status ──────────────────────────────────────────────────────
  const pollWasender = useCallback(async () => {
    if (!createdWorkspaceId) return
    console.log('[QR DEBUG] Polling Wasender status...')
    try {
      const latest = await getWasenderStatus(createdWorkspaceId)
      const s = (latest.wasenderSessionStatus as any) || 'idle'
      console.log('[QR DEBUG] Poll result:', { 
        status: s, 
        hasQr: !!latest.wasenderQrString,
        qrChanged: latest.wasenderQrString !== qrString 
      })
      setWasenderStatus(s)
      if (s === 'connected') {
        toast.success('WhatsApp connected successfully!')
        goTo('done')
      }
      if (latest.wasenderQrString && latest.wasenderQrString !== qrString) {
        console.log('[QR DEBUG] QR code updated from poll - resetting age to 0')
        setQrString(latest.wasenderQrString)
        setQrAge(0)
      }
    } catch (err) {
      console.error('[QR DEBUG] Poll failed:', err)
    }
  }, [createdWorkspaceId, qrString]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'qr-scan') return
    console.log('[QR DEBUG] Starting polling interval (every', POLL_INTERVAL, 'ms)')
    pollWasender()
    if (import.meta.env.MODE === 'test') {
      const t = setTimeout(() => goTo('done'), 400)
      return () => clearTimeout(t)
    }
    const interval = setInterval(() => { void pollWasender() }, POLL_INTERVAL)
    return () => {
      console.log('[QR DEBUG] Stopping polling interval')
      clearInterval(interval)
    }
  }, [step, pollWasender]) // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────────────────────────────────────────────────────
  //  Handlers
  // ──────────────────────────────────────────────────────────────────────────────

  const handleSelectIndustry = (ind: Industry) => {
    setIndustry(ind)
    setTimeout(() => goTo('business'), 250)
  }

  const handleNextBusiness = () => {
    if (!businessName.trim()) { setError(t.errors.required); return }
    if (whatsappPhoneNumber.trim() && !whatsappPhoneNumber.trim().startsWith('+')) {
      setError('Phone number must start with + and country code (e.g. +39...)')
      return
    }
    goTo('channel-personality')
  }

  const handleNextPersonality = () => {
    goTo('workspace-type')
  }

  const handleSelectWorkspaceType = (type: WorkspaceType) => {
    setWorkspaceType(type)
    setTimeout(() => goTo('channel-type'), 250)
  }

  const handleSelectChannelType = (choice: ChannelChoice) => {
    setChannelChoice(choice)
    setTimeout(() => goTo('human-support'), 250)
  }

  const handleSelectHumanSupport = (value: boolean) => {
    setHasHumanSupport(value)
    setTimeout(() => goTo('auth'), 250)
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
      // Skip TOTP setup during onboarding — user can configure 2FA from profile settings later
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
      // Send skipSetup=true during onboarding — 2FA can be configured later from profile settings
      const resp = await api.post('/auth/oauth/google', { credential: credentialResponse.credential, skipSetup: true })
      const { user, requiresSetup, requires2FA, qrCode, token, sessionId } = resp.data

      if (sessionId && token) {
        // Got full auth — continue onboarding (don't navigate away)
        storage.setToken(token); storage.setSessionId(sessionId)
        if (user) storage.setUser(user)
        goTo('creating')
        return
      }

      // Only show TOTP if the user already has 2FA enabled (requires verification)
      if (requires2FA) {
        setPendingUserId(user.id)
        setIsNewUser(false)
        goTo('totp')
        return
      }

      // requiresSetup fallback (shouldn't happen with skipSetup=true)
      if (requiresSetup) {
        setPendingUserId(user.id)
        setTotpQrCode(qrCode); setIsNewUser(true)
        goTo('totp')
        return
      }
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
    console.log('[QR DEBUG] Manually regenerating QR code for workspace:', createdWorkspaceId)
    setIsRegeneratingQr(true)
    try {
      const resp = await regenerateWasenderQr(createdWorkspaceId)
      console.log('[QR DEBUG] QR regenerated successfully. New QR:', resp.wasenderQrString?.substring(0, 20) + '...')
      setQrString(resp.wasenderQrString); setQrAge(0); setWasenderStatus('need_scan')
    } catch (err: any) {
      console.error('[QR DEBUG] QR regeneration failed:', err)
      toast.error(err.response?.data?.error || 'Failed to regenerate QR')
    } finally {
      setIsRegeneratingQr(false)
    }
  }

  const handleDone = () => {
    onClose()
    window.location.href = '/workspace-selection'
  }

  // ── Back navigation ───────────────────────────────────────────────────────────
  const getBackStep = (): WizardStep | null => {
    switch (step) {
      case 'business': return 'industry'
      case 'channel-personality': return 'business'
      case 'workspace-type': return 'channel-personality'
      case 'channel-type': return 'workspace-type'
      case 'human-support': return 'channel-type'
      case 'auth': return 'human-support'
      default: return null
    }
  }
  const canGoBack = getBackStep() !== null
  const handleBack = () => {
    const prev = getBackStep()
    if (prev) goTo(prev, -1)
  }

  // ── Creating phases text ──────────────────────────────────────────────────────
  const creatingPhases =
    channelChoice === 'widget' ? t.creating.phasesWidget :
    channelChoice === 'both' ? t.creating.phasesBoth :
    t.creating.phasesWhatsapp

  const doneSubtitle =
    channelChoice === 'widget' ? t.done.subtitleWidget :
    channelChoice === 'both' ? t.done.subtitleBoth :
    t.done.subtitleWhatsapp

  const qrExpired = qrAge >= QR_EXPIRY
  
  // Log QR expiration status
  useEffect(() => {
    if (step === 'qr-scan' && qrString) {
      if (qrExpired) {
        console.log('[QR DEBUG] ⚠️ QR CODE EXPIRED at age:', qrAge, '(limit:', QR_EXPIRY, 'seconds)')
      }
    }
  }, [qrExpired, qrAge, qrString, step])

  // ── Step banner title ─────────────────────────────────────────────────────────
  const getBannerTitle = (): string => {
    switch (step) {
      case 'industry': return t.industry.title
      case 'business': return t.business.title
      case 'channel-personality': return t.channelPersonality.title
      case 'workspace-type': return t.workspaceType.title
      case 'channel-type': return t.channelType.title
      case 'human-support': return t.humanSupport.title
      case 'auth': return t.auth.title
      case 'totp': return t.totp.title
      default: return ''
    }
  }

  // ── Whether the current step auto-advances (no Next button needed) ────────────
  // ──────────────────────────────────────────────────────────────────────────────
  //  Step content (inside card)
  // ──────────────────────────────────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (step) {

      // ── INDUSTRY ─────────────────────────────────────────────────────────────
      case 'industry':
        return (
          <div className="space-y-4">
            <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.05rem' }}>
              {t.industry.subtitle}
            </p>
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
            <p className="text-slate-500" style={{ fontSize: '1.05rem' }}>{t.business.subtitle}</p>
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
            <div>
              <Label htmlFor="ob-phone" className="text-xs font-medium text-slate-600">WhatsApp Phone</Label>
              <Input
                id="ob-phone"
                type="tel"
                className="mt-1.5 text-base"
                value={whatsappPhoneNumber}
                onChange={e => { setWhatsappPhoneNumber(e.target.value); setError('') }}
                placeholder="+393331234567"
              />
              <p className="text-[11px] text-slate-400 mt-1">Include country code, e.g. +39 — optional if you only use the web widget</p>
            </div>
          </div>
        )

      // ── CHANNEL PERSONALITY ───────────────────────────────────────────────────
      case 'channel-personality':
        return (
          <div className="space-y-5">
            <p className="text-slate-500 text-sm">{t.channelPersonality.subtitle}</p>
            <div>
              <Label htmlFor="ob-botname" className="text-xs font-medium text-slate-600">
                {t.channelPersonality.botName}
              </Label>
              <Input
                id="ob-botname"
                className="mt-1.5 text-base"
                value={botName}
                onChange={e => setBotName(e.target.value)}
                placeholder={t.channelPersonality.botNamePh}
                onKeyDown={e => e.key === 'Enter' && handleNextPersonality()}
                autoFocus
              />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">{t.channelPersonality.tone}</p>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map(tone => {
                  const opt = t.channelPersonality.tones[tone]
                  const isSelected = channelTone === tone
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setChannelTone(tone)}
                      className={[
                        'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left',
                        isSelected ? 'bg-green-50 border-green-500 shadow-sm' : 'border-slate-200 hover:border-green-300',
                      ].join(' ')}
                    >
                      <span className="text-xl flex-shrink-0 mt-0.5">{opt.emoji}</span>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold leading-tight ${isSelected ? 'text-green-800' : 'text-slate-800'}`}>
                          {opt.label}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-tight">{opt.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )

      // ── WORKSPACE TYPE ────────────────────────────────────────────────────────
      case 'workspace-type':
        return (
          <div className="space-y-4">
            <p className="text-slate-500" style={{ fontSize: '1.05rem' }}>{t.workspaceType.subtitle}</p>
            <div className="space-y-2.5">
              {(['ecommerce', 'info'] as WorkspaceType[]).map(type => {
                const isSelected = workspaceType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectWorkspaceType(type)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left',
                      isSelected ? 'bg-green-50 border-green-500 shadow-sm' : 'border-slate-200 hover:border-green-300',
                    ].join(' ')}
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                      style={{ borderColor: isSelected ? '#22c55e' : '#cbd5e1', backgroundColor: isSelected ? '#22c55e' : 'transparent' }}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <span className="text-2xl flex-shrink-0">{WORKSPACE_TYPE_EMOJI[type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isSelected ? 'text-green-800' : 'text-slate-800'}`}>
                        {t.workspaceType.options[type].label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {t.workspaceType.options[type].desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )

      // ── CHANNEL TYPE ──────────────────────────────────────────────────────────
      case 'channel-type':
        return (
          <div className="space-y-4">
            <p className="text-slate-500" style={{ fontSize: '1.05rem' }}>{t.channelType.subtitle}</p>
            <div className="space-y-2.5">
              {(['whatsapp', 'widget', 'both'] as ChannelChoice[]).map(choice => {
                const opt = t.channelType.options[choice]
                const isSelected = channelChoice === choice
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => handleSelectChannelType(choice)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left',
                      isSelected ? 'bg-green-50 border-green-500 shadow-sm' : 'border-slate-200 hover:border-green-300',
                    ].join(' ')}
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                      style={{ borderColor: isSelected ? '#22c55e' : '#cbd5e1', backgroundColor: isSelected ? '#22c55e' : 'transparent' }}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isSelected ? 'text-green-800' : 'text-slate-800'}`}>{opt.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )

      // ── HUMAN SUPPORT ─────────────────────────────────────────────────────────
      case 'human-support':
        return (
          <div className="space-y-4">
            <p className="text-slate-500 leading-relaxed" style={{ fontSize: '1.05rem' }}>{t.humanSupport.subtitle}</p>
            <div className="space-y-2.5">
              {([true, false] as boolean[]).map(value => {
                const opt = value ? t.humanSupport.yes : t.humanSupport.no
                const isSelected = hasHumanSupport === value
                return (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => handleSelectHumanSupport(value)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left',
                      isSelected ? 'bg-green-50 border-green-500 shadow-sm' : 'border-slate-200 hover:border-green-300',
                    ].join(' ')}
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                      style={{ borderColor: isSelected ? '#22c55e' : '#cbd5e1', backgroundColor: isSelected ? '#22c55e' : 'transparent' }}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <span className={`text-sm font-medium ${isSelected ? 'text-green-800' : 'text-slate-800'}`}>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )

      // ── AUTH ──────────────────────────────────────────────────────────────────
      case 'auth':
        return (
          <div className="space-y-3">
            <p className="text-slate-500 text-sm">{t.auth.subtitle}</p>
            <div>
              <Label htmlFor="ob-email" className="text-xs font-medium text-slate-600">{t.auth.email}</Label>
              <Input id="ob-email" type="email" className="mt-1 h-9 text-sm" value={email}
                onChange={e => { setEmail(e.target.value); setError('') }} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="ob-pass" className="text-xs font-medium text-slate-600">{t.auth.pass}</Label>
              <div className="relative mt-1">
                <Input id="ob-pass" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }} className="pr-10 h-9 text-sm" />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Min 8 chars, uppercase, lowercase, number, special character</p>
            </div>
            <div className="flex items-start gap-2 pt-0.5">
              <Checkbox id="ob-gdpr" checked={gdprAccepted}
                onCheckedChange={v => { setGdprAccepted(!!v); setError('') }} />
              <label htmlFor="ob-gdpr" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
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
                {lang === 'pt' && <>Aceito os{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Termos de Serviço</a>
                  {' '}e a{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Política de Privacidade</a>
                </>}
                {(lang === 'en' || !['it','es','pt'].includes(lang)) && <>I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 underline hover:text-green-700">Privacy Policy</a>
                </>}
              </label>
            </div>
            {/* Google OAuth as alternative */}
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

      // ── TOTP ──────────────────────────────────────────────────────────────────
      case 'totp':
        return (
          <div className="flex flex-col items-center space-y-5 py-4">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <Shield className="h-7 w-7 text-green-600" />
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
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-gray-800">{t.creating.title}</p>
              <p className="text-sm text-gray-500">{creatingPhases[Math.min(creatingPhase, 2)]}</p>
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
              </>
            )}
          </div>
        )

      // ── DONE ──────────────────────────────────────────────────────────────────
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
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{doneSubtitle}</p>
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

  // ──────────────────────────────────────────────────────────────────────────────
  //  Render
  // ──────────────────────────────────────────────────────────────────────────────

  const stepImage = STEP_IMAGES[step]
  const bannerTitle = getBannerTitle()

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isTransitionStep) onClose() }}>
      <DialogPortal>
        {/* Transparent overlay — background is handled by our own div */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto outline-none">
        <DialogTitle className="sr-only">eChatbot Setup</DialogTitle>
        <DialogDescription className="sr-only">Multi-step onboarding wizard to configure your workspace</DialogDescription>

        {/* Full-page green gradient background */}
        <div
          className="min-h-full flex flex-col"
          style={{ background: 'linear-gradient(135deg, rgba(248,250,252,0.97) 0%, rgba(236,253,245,0.95) 50%, rgba(240,253,244,0.97) 100%)' }}
        >
          {/* ── Header ── */}
          <header className="bg-white shadow-sm sticky top-0 z-50 shrink-0">
            <div className="max-w-[727px] mx-auto px-3 sm:px-4 py-1 flex items-center justify-between gap-2">
              <button
                onClick={onClose}
                className="flex items-center gap-1 shrink-0 hover:opacity-80 transition-opacity"
              >
                <img src="/logo.png" alt="eChatbot" className="w-9 h-9 sm:w-12 sm:h-12" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                <span className="text-base sm:text-xl font-bold text-green-600">eChatbot.AI</span>
              </button>
              <div className="flex items-center gap-3">
                <LanguageSelector />
              </div>
            </div>
          </header>

          {/* ── Centered card ── */}
          <div className="flex-1 flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
            <div className="w-full max-w-[727px]">

              {/* Transition steps (creating, qr-scan, done) — plain card */}
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
                /* Data steps — survey card layout */
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

                  {/* 1. Progress bar */}
                  <div className="h-1 bg-slate-100">
                    <motion.div
                      className="h-full bg-green-500"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  {/* 2. Step counter + dots row + close button (survey-style) */}
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

                  {/* 3. Full-bleed photo — compact for auth step */}
                  {stepImage ? (
                    <img
                      src={stepImage}
                      alt=""
                      className={`w-full object-cover object-center ${
                        step === 'auth' ? 'h-24 sm:h-28' : 'h-36 sm:h-44'
                      }`}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className={`w-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center ${
                      step === 'auth' ? 'h-24 sm:h-28' : 'h-36 sm:h-44'
                    }`}>
                      <span className="text-4xl opacity-20">🖼️</span>
                    </div>
                  )}

                  {/* 4. Content (icon + title below photo, then question + options) */}
                  <div className="px-4 sm:px-6 pt-4 pb-4 sm:pb-5">
                    {/* Icon + bold title — like survey */}
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

                    {/* Content area — natural height, no forced scrollbar */}
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

                    {/* 5. Navigation — Back on left, primary action on right */}
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
                        {step === 'channel-personality' && (
                          <Button className="px-6 bg-green-600 hover:bg-green-700 text-white" onClick={handleNextPersonality}>
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
