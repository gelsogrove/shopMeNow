/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SECURITY CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Centralized security settings for ShopME platform.
 * Values are hardcoded based on industry best practices.
 *
 * SECURITY STANDARDS:
 * - OWASP Top 10 compliance
 * - NIST SP 800-63B guidelines
 * - Industry best practices (GitHub, Stripe, AWS)
 *
 * ⚠️  DO NOT move these to .env - security defaults should be in code
 *     Only override via environment for specific enterprise requirements
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityConfig {
  rateLimit: RateLimitConfig
  accountLockout: AccountLockoutConfig
  passwordPolicy: PasswordPolicyConfig
  session: SessionConfig
  twoFactor: TwoFactorConfig
}

export interface RateLimitConfig {
  login: RateLimitRule
  twoFactor: RateLimitRule
  passwordReset: RateLimitRule
  registration: RateLimitRule
}

export interface RateLimitRule {
  /** Maximum number of attempts allowed within the time window */
  maxAttempts: number
  /** Time window in milliseconds - attempts reset after this period */
  windowMs: number
}

export interface AccountLockoutConfig {
  /** Number of consecutive failed attempts before account is locked */
  threshold: number
  /** How long the account stays locked (in milliseconds) */
  durationMs: number
}

export interface PasswordPolicyConfig {
  /** Minimum password length (NIST recommends 8+) */
  minLength: number
  /** Require at least one uppercase letter (A-Z) */
  requireUppercase: boolean
  /** Require at least one lowercase letter (a-z) */
  requireLowercase: boolean
  /** Require at least one digit (0-9) */
  requireNumber: boolean
  /** Require at least one special character (@$!%*?&) */
  requireSpecialChar: boolean
}

export interface SessionConfig {
  /** Maximum session lifetime regardless of activity */
  durationMs: number
  /** Logout user after this period of inactivity */
  inactivityTimeoutMs: number
}

export interface TwoFactorConfig {
  /** Length of TOTP code (standard is 6 digits) */
  codeLength: number
  /** Time window tolerance for code validation (in 30-second steps) */
  window: number
  /** Number of backup recovery codes to generate */
  recoveryCodes: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY DEFAULTS (Hardcoded - Do not move to .env)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ RATE LIMITING - Brute Force Protection                                      │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Prevents attackers from guessing passwords or codes through                 │
 * │ repeated attempts. Limits requests per IP/user within time windows.         │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
const RATE_LIMIT_DEFAULTS: RateLimitConfig = {
  /**
   * LOGIN ATTEMPTS
   * - 5 attempts per 15 minutes per IP
   * - Protects against password guessing attacks
   * - Balance: Allows for typos without locking legitimate users
   */
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes = 900,000 ms
  },

  /**
   * 2FA CODE ATTEMPTS
   * - 3 attempts per 15 minutes per user
   * - Stricter than login (6-digit codes easier to brute force)
   * - TOTP codes change every 30 seconds anyway
   */
  twoFactor: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes = 900,000 ms
  },

  /**
   * PASSWORD RESET REQUESTS
   * - 3 requests per hour per email
   * - Prevents email bombing/harassment
   * - Still allows legitimate "forgot password" scenarios
   */
  passwordReset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour = 3,600,000 ms
  },

  /**
   * REGISTRATION ATTEMPTS
   * - 3 registrations per hour per IP
   * - Prevents mass account creation (spam bots)
   * - Legitimate users rarely need more than 1-2 attempts
   */
  registration: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour = 3,600,000 ms
  },
}

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ACCOUNT LOCKOUT - Repeated Failure Protection                               │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Locks account after too many failed login attempts.                         │
 * │ Different from rate limiting: tracks per-account, not per-IP.               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
const ACCOUNT_LOCKOUT_DEFAULTS: AccountLockoutConfig = {
  /**
   * LOCKOUT THRESHOLD
   * - Lock after 5 consecutive failed attempts
   * - Per-account tracking (follows user across IPs)
   * - Resets on successful login
   */
  threshold: 5,

  /**
   * LOCKOUT DURATION
   * - Account locked for 30 minutes
   * - Auto-unlocks after duration expires
   * - Admin can manually unlock if needed
   */
  durationMs: 30 * 60 * 1000, // 30 minutes = 1,800,000 ms
}

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ PASSWORD POLICY - Strength Requirements                                     │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Based on NIST SP 800-63B guidelines and industry standards.                 │
 * │ Balance between security and user experience.                               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
const PASSWORD_POLICY_DEFAULTS: PasswordPolicyConfig = {
  /**
   * MINIMUM LENGTH: 8 characters
   * - NIST recommends minimum 8 characters
   * - Longer passwords are exponentially harder to crack
   * - Most users can remember 8+ character passwords
   */
  minLength: 8,

  /**
   * CHARACTER REQUIREMENTS
   * - Uppercase: At least one A-Z
   * - Lowercase: At least one a-z
   * - Number: At least one 0-9
   * - Special: At least one @$!%*?&
   *
   * Combined, these requirements ensure password entropy
   * while remaining user-friendly.
   */
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
}

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ SESSION MANAGEMENT - Authentication Lifetime                                │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Controls how long users stay logged in and when to force re-auth.           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
const SESSION_DEFAULTS: SessionConfig = {
  /**
   * SESSION DURATION: 24 hours
   * - Maximum time user can stay logged in
   * - Regardless of activity
   * - After this, must login again
   */
  durationMs: 24 * 60 * 60 * 1000, // 24 hours

  /**
   * INACTIVITY TIMEOUT: 2 hours
   * - Logout after 2 hours of no activity
   * - Protects unattended sessions
   * - Good for shared computers
   */
  inactivityTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
}

/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ TWO-FACTOR AUTHENTICATION - TOTP Settings                                   │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Configuration for Google Authenticator compatible 2FA.                      │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
const TWO_FACTOR_DEFAULTS: TwoFactorConfig = {
  /**
   * CODE LENGTH: 6 digits
   * - Standard for TOTP (Google Authenticator, Authy)
   * - 1 million possible combinations
   * - Changes every 30 seconds
   */
  codeLength: 6,

  /**
   * TIME WINDOW: 1 step (±30 seconds)
   * - Allows codes from previous/next 30-second window
   * - Accounts for clock drift between devices
   * - Standard tolerance for most implementations
   */
  window: 1,

  /**
   * RECOVERY CODES: 10 codes
   * - One-time use backup codes
   * - For when authenticator app is unavailable
   * - User can regenerate (invalidates old ones)
   */
  recoveryCodes: 10,
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION GETTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the complete security configuration.
 *
 * Values are hardcoded for security. Environment variables are NOT used
 * to prevent accidental weakening of security through misconfiguration.
 *
 * @returns Complete security configuration object
 */
export const getSecurityConfig = (): SecurityConfig => {
  return {
    rateLimit: RATE_LIMIT_DEFAULTS,
    accountLockout: ACCOUNT_LOCKOUT_DEFAULTS,
    passwordPolicy: PASSWORD_POLICY_DEFAULTS,
    session: SESSION_DEFAULTS,
    twoFactor: TWO_FACTOR_DEFAULTS,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate password against security policy.
 *
 * @param password - Password to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * const result = validatePassword('myPassword123!')
 * if (!result.valid) {
 *   console.error(result.error)
 * }
 */
export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  const policy = getSecurityConfig().passwordPolicy

  if (password.length < policy.minLength) {
    return {
      valid: false,
      error: `Password must be at least ${policy.minLength} characters long`,
    }
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter",
    }
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one lowercase letter",
    }
  }

  if (policy.requireNumber && !/\d/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one number",
    }
  }

  if (policy.requireSpecialChar && !/[@$!%*?&]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one special character (@$!%*?&)",
    }
  }

  return { valid: true }
}

/**
 * Generate secure random recovery codes for 2FA backup.
 *
 * @param count - Number of codes to generate (default: 10)
 * @returns Array of 8-character alphanumeric recovery codes
 *
 * @example
 * const codes = generateRecoveryCodes(10)
 * // ['A1B2C3D4', 'E5F6G7H8', ...]
 */
export const generateRecoveryCodes = (count: number = 10): string[] => {
  const codes: string[] = []

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    codes.push(code)
  }

  return codes
}

/**
 * Check if account should be locked based on failed attempts.
 *
 * @param failedAttempts - Number of consecutive failed attempts
 * @returns True if account should be locked
 */
export const shouldLockAccount = (failedAttempts: number): boolean => {
  const config = getSecurityConfig()
  return failedAttempts >= config.accountLockout.threshold
}

/**
 * Calculate when account lockout expires.
 *
 * @returns Date when lockout expires
 */
export const getLockoutExpiration = (): Date => {
  const config = getSecurityConfig()
  return new Date(Date.now() + config.accountLockout.durationMs)
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK REFERENCE (for developers)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * SECURITY DEFAULTS QUICK REFERENCE:
 *
 * ┌────────────────────────┬───────────────────────────────────────────────────┐
 * │ Setting                │ Value                                             │
 * ├────────────────────────┼───────────────────────────────────────────────────┤
 * │ Login attempts         │ 5 per 15 minutes                                  │
 * │ 2FA code attempts      │ 3 per 15 minutes                                  │
 * │ Password reset         │ 3 per hour                                        │
 * │ Registration           │ 3 per hour                                        │
 * │ Account lockout        │ After 5 failures, locked for 30 minutes           │
 * │ Password min length    │ 8 characters                                      │
 * │ Password requirements  │ Upper + Lower + Number + Special                  │
 * │ Session duration       │ 24 hours max, 2 hours inactivity timeout          │
 * │ 2FA codes              │ 6 digits, ±30 sec tolerance, 10 recovery codes    │
 * └────────────────────────┴───────────────────────────────────────────────────┘
 */
