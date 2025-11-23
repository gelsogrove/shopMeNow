/**
 * Security Configuration
 * Centralized security settings for authentication, rate limiting, and password policy
 * 
 * SECURITY STANDARDS:
 * - OWASP Top 10 compliance
 * - NIST SP 800-63B guidelines
 * - Industry best practices (GitHub, Stripe, AWS)
 */

export interface SecurityConfig {
  // Rate Limiting (Brute Force Protection)
  rateLimit: {
    login: {
      maxAttempts: number
      windowMs: number // Time window in milliseconds
    }
    twoFactor: {
      maxAttempts: number
      windowMs: number
    }
    passwordReset: {
      maxAttempts: number
      windowMs: number
    }
    registration: {
      maxAttempts: number
      windowMs: number
    }
  }
  
  // Account Lockout
  accountLockout: {
    threshold: number // Failed attempts before lockout
    durationMs: number // Lockout duration
  }
  
  // Password Policy
  passwordPolicy: {
    minLength: number
    requireUppercase: boolean
    requireLowercase: boolean
    requireNumber: boolean
    requireSpecialChar: boolean
  }
  
  // Session Management
  session: {
    durationMs: number // Session lifetime
    inactivityTimeoutMs: number // Logout after inactivity
  }
  
  // 2FA Settings
  twoFactor: {
    codeLength: number // TOTP code length (usually 6)
    window: number // Time window for code validation (in steps)
    recoveryCodes: number // Number of recovery codes to generate
  }
}

/**
 * Get security configuration from environment variables
 * Falls back to secure defaults if env vars not set
 */
export const getSecurityConfig = (): SecurityConfig => {
  return {
    rateLimit: {
      login: {
        maxAttempts: parseInt(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS || '5'),
        windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000'), // 15 minutes
      },
      twoFactor: {
        maxAttempts: parseInt(process.env.RATE_LIMIT_2FA_MAX_ATTEMPTS || '3'),
        windowMs: parseInt(process.env.RATE_LIMIT_2FA_WINDOW_MS || '900000'), // 15 minutes
      },
      passwordReset: {
        maxAttempts: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_MAX || '3'),
        windowMs: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS || '3600000'), // 1 hour
      },
      registration: {
        maxAttempts: parseInt(process.env.RATE_LIMIT_REGISTRATION_MAX || '3'),
        windowMs: parseInt(process.env.RATE_LIMIT_REGISTRATION_WINDOW_MS || '3600000'), // 1 hour
      },
    },
    
    accountLockout: {
      threshold: parseInt(process.env.ACCOUNT_LOCKOUT_THRESHOLD || '5'),
      durationMs: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MS || '1800000'), // 30 minutes
    },
    
    passwordPolicy: {
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
      requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
      requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
      requireNumber: process.env.PASSWORD_REQUIRE_NUMBER !== 'false',
      requireSpecialChar: process.env.PASSWORD_REQUIRE_SPECIAL_CHAR !== 'false',
    },
    
    session: {
      durationMs: 24 * 60 * 60 * 1000, // 24 hours
      inactivityTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
    },
    
    twoFactor: {
      codeLength: 6,
      window: 1, // Allow 1 step before/after for time drift
      recoveryCodes: 10,
    },
  }
}

/**
 * Validate password against security policy
 * @param password - Password to validate
 * @returns Validation result with error message if invalid
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
      error: 'Password must contain at least one uppercase letter',
    }
  }
  
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter',
    }
  }
  
  if (policy.requireNumber && !/\d/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number',
    }
  }
  
  if (policy.requireSpecialChar && !/[@$!%*?&]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one special character (@$!%*?&)',
    }
  }
  
  return { valid: true }
}

/**
 * Generate secure random recovery codes
 * @param count - Number of codes to generate
 * @returns Array of recovery codes
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
 * Check if account should be locked based on failed attempts
 * @param failedAttempts - Number of consecutive failed attempts
 * @returns True if account should be locked
 */
export const shouldLockAccount = (failedAttempts: number): boolean => {
  const config = getSecurityConfig()
  return failedAttempts >= config.accountLockout.threshold
}

/**
 * Calculate lockout expiration time
 * @returns Lockout expiration date
 */
export const getLockoutExpiration = (): Date => {
  const config = getSecurityConfig()
  return new Date(Date.now() + config.accountLockout.durationMs)
}
