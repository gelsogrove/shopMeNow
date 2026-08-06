/**
 * DemoPasswordGate
 *
 * Password prompt shown before a public demo page. Once the right password is
 * entered the unlock is remembered in localStorage for 4 hours, so a visitor
 * who reloads (or comes back later the same session) is not asked again.
 *
 * 🔓 Scope — this is a LIGHT barrier, agreed with Andrea (2026-08-06), not
 * real access control. The password below ships inside the frontend bundle, so
 * anyone reading the JS can find it and skip the gate. It exists to stop the
 * demo from being stumbled upon casually. Do NOT put anything genuinely
 * private behind it — that needs a server-side check.
 *
 * ⚠️ Hardcoded password — exception to project rule 1 (no hardcoded values),
 * requested explicitly by Andrea on 2026-08-06 per rule 1C, after first
 * choosing an env var. Rationale: as a VITE_ variable the password was already
 * public in the bundle, so configuration bought no secrecy — only an extra
 * deploy step. Changing it now requires editing this line and rebuilding.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react"

const UNLOCK_STORAGE_KEY = "echatbot-demo-unlocked-until"
const UNLOCK_DURATION_MS = 4 * 60 * 60 * 1000 // 4 hours

// Hardcoded on Andrea's explicit instruction (2026-08-06) — see the header note.
const DEMO_PASSWORD = "Admin@123"

/** True when a previous unlock is stored and has not expired yet. */
function readStoredUnlock(): boolean {
  try {
    const raw = localStorage.getItem(UNLOCK_STORAGE_KEY)
    if (!raw) return false
    const expiresAt = Number(raw)
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
      localStorage.removeItem(UNLOCK_STORAGE_KEY)
      return false
    }
    return true
  } catch {
    // Private browsing / storage disabled: fall back to asking every time.
    return false
  }
}

function storeUnlock(): void {
  try {
    localStorage.setItem(UNLOCK_STORAGE_KEY, String(Date.now() + UNLOCK_DURATION_MS))
  } catch {
    // Not being able to persist only means the visitor is asked again later.
  }
}

interface DemoPasswordGateProps {
  children: ReactNode
}

export function DemoPasswordGate({ children }: DemoPasswordGateProps) {
  // `null` = still reading localStorage, so nothing flashes before we know.
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUnlocked(readStoredUnlock())
  }, [])

  // Re-lock the page the moment the stored window expires, without a reload.
  useEffect(() => {
    if (unlocked !== true) return
    const interval = window.setInterval(() => {
      if (!readStoredUnlock()) setUnlocked(false)
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [unlocked])

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      if (password !== DEMO_PASSWORD) {
        setError("Wrong password. Please try again.")
        setPassword("")
        return
      }
      storeUnlock()
      setUnlocked(true)
      setError(null)
    },
    [password]
  )

  if (unlocked === null) return null
  if (unlocked) return <>{children}</>

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur"
      >
        <h1 className="text-xl font-bold text-slate-900">Protected demo</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the password to access this demo.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          Enter
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Access stays unlocked for 4 hours on this browser.
        </p>
      </form>
    </div>
  )
}

export default DemoPasswordGate
