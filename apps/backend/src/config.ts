import { Secret } from "jsonwebtoken"

export interface Config {
  port: number
  jwt: {
    secret: Secret
    expiresIn: string
  }
  jwtSecret: string
  database: {
    url: string
  }
  cors: {
    origin: string
  }
  frontendUrl: string
  backofficeUrl: string
  appUrl: string
  dhlTrackingBaseUrl: string
  llm: {
    defaultPrice: number
  }
  pushMessaging: {
    price: number
  }
  token: {
    expiration: string
  }
}

// SECURITY: JWT_SECRET must be set - no fallback allowed
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET
  if (!secret || secret === 'your-secret-key') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET must be set in production!')
    }
    // Only allow default in development with warning
    console.warn('⚠️ WARNING: Using default JWT_SECRET - NEVER use in production!')
    return 'dev-only-secret-change-in-production'
  }
  return secret
}

export const config: Config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwt: {
    secret: getJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  },
  jwtSecret: getJwtSecret(),
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/shop_db",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173", // Fixed: Vite runs on 5173, not 3000
  backofficeUrl: process.env.BACKOFFICE_URL || "http://localhost:3002", // Backoffice SPA (separate port in dev; served by this app on backoffice.echatbot.ai in prod)
  appUrl: process.env.APP_URL || "http://localhost:3001", // Backend API URL for OpenRouter HTTP-Referer
  dhlTrackingBaseUrl:
    process.env.DHL_TRACKING_BASE_URL ||
    "https://www.dhl.com/global-en/home/tracking/tracking-express.html",
  llm: {
    defaultPrice: parseFloat(process.env.DEFAULT_LLM_PRICE || "0.15"),
  },
  pushMessaging: {
    price: parseFloat(process.env.PUSH_MESSAGE_PRICE || "1.00"),
  },
  token: {
    expiration: process.env.TOKEN_EXPIRATION || "1h",
  },
}

export const buildDhlTrackingUrl = (
  trackingNumber?: string | null
): string | null => {
  if (!trackingNumber) return null
  const base = config.dhlTrackingBaseUrl
  const sep = base.includes("?") ? "&" : "?"
  return `${base}${sep}tracking-id=${encodeURIComponent(trackingNumber)}`
}
