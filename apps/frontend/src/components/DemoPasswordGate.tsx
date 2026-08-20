/**
 * DemoPasswordGate
 *
 * Credentials prompt shown before a public demo page. Once the right pair is
 * entered the unlock is remembered in localStorage, so a visitor who reloads
 * (or comes back later) is not asked again until the window expires.
 *
 * 🔓 Scope — this is a LIGHT barrier, agreed with Andrea (2026-08-06), not
 * real access control. The credentials below ship inside the frontend bundle,
 * so anyone reading the JS can find them and skip the gate. It exists to stop
 * the demo from being stumbled upon casually. Do NOT put anything genuinely
 * private behind it — that needs a server-side check.
 *
 * ⚠️ Hardcoded credentials — exception to project rule 1 (no hardcoded values),
 * requested explicitly by Andrea on 2026-08-06 per rule 1C, after first
 * choosing an env var. Rationale: as a VITE_ variable the password was already
 * public in the bundle, so configuration bought no secrecy — only an extra
 * deploy step. Changing them now requires editing these lines and rebuilding.
 *
 * Per-demo credentials: pass `username` / `password` / `unlockHours` to give a
 * demo its own pair (Andrea 2026-08-21, ecolaundry). The defaults keep the
 * original demorobot behaviour untouched.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react"

const UNLOCK_STORAGE_KEY = "echatbot-demo-unlocked-until"

// Hardcoded on Andrea's explicit instruction (2026-08-06) — see the header note.
const DEFAULT_PASSWORD = "Admin@123"
const DEFAULT_UNLOCK_HOURS = 4

/** True when a previous unlock is stored and has not expired yet. */
function readStoredUnlock(storageKey: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return false
    const expiresAt = Number(raw)
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
      localStorage.removeItem(storageKey)
      return false
    }
    return true
  } catch {
    // Private browsing / storage disabled: fall back to asking every time.
    return false
  }
}

function storeUnlock(storageKey: string, durationMs: number): void {
  try {
    localStorage.setItem(storageKey, String(Date.now() + durationMs))
  } catch {
    // Not being able to persist only means the visitor is asked again later.
  }
}

interface DemoPasswordGateProps {
  children: ReactNode
  /** Required username. Omit for a password-only gate (demorobot). */
  username?: string
  /** Required password. Defaults to the shared demo password. */
  password?: string
  /** How long an unlock lasts on this browser. */
  unlockHours?: number
  /** Storage suffix so unlocking one demo does not unlock another. */
  storageScope?: string
}

export function DemoPasswordGate({
  children,
  username: expectedUsername,
  password: expectedPassword = DEFAULT_PASSWORD,
  unlockHours = DEFAULT_UNLOCK_HOURS,
  storageScope,
}: DemoPasswordGateProps) {
  const storageKey = storageScope ? `${UNLOCK_STORAGE_KEY}-${storageScope}` : UNLOCK_STORAGE_KEY
  const unlockDurationMs = unlockHours * 60 * 60 * 1000
  // `null` = still reading localStorage, so nothing flashes before we know.
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUnlocked(readStoredUnlock(storageKey))
  }, [storageKey])

  // Re-lock the page the moment the stored window expires, without a reload.
  useEffect(() => {
    if (unlocked !== true) return
    const interval = window.setInterval(() => {
      if (!readStoredUnlock(storageKey)) setUnlocked(false)
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [unlocked, storageKey])

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      const usernameOk = !expectedUsername || username.trim() === expectedUsername
      if (!usernameOk || password !== expectedPassword) {
        setError(
          expectedUsername
            ? "Wrong username or password. Please try again."
            : "Wrong password. Please try again."
        )
        setPassword("")
        return
      }
      storeUnlock(storageKey, unlockDurationMs)
      setUnlocked(true)
      setError(null)
    },
    [username, password, expectedUsername, expectedPassword, storageKey, unlockDurationMs]
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
          {expectedUsername
            ? "Enter your username and password to access this demo."
            : "Enter the password to access this demo."}
        </p>

        {expectedUsername && (
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError(null)
            }}
            placeholder="Username"
            autoFocus
            autoComplete="username"
            className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
          placeholder="Password"
          autoFocus={!expectedUsername}
          autoComplete="current-password"
          className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          Enter
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Access stays unlocked for {unlockHours} hours on this browser.
        </p>
      </form>
    </div>
  )
}

export default DemoPasswordGate
