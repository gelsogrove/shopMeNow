const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
} as const

type LogLevel = keyof typeof LOG_LEVELS

const resolveLogLevel = (): LogLevel => {
  const envLevel = (import.meta.env.VITE_LOG_LEVEL || "").toLowerCase()
  if (envLevel in LOG_LEVELS) {
    return envLevel as LogLevel
  }

  return import.meta.env.PROD ? "warn" : "info"
}

const currentLevel = LOG_LEVELS[resolveLogLevel()]

const canLog = (level: LogLevel) => LOG_LEVELS[level] >= currentLevel

// Simple logger with env-controlled level
export const logger = {
  debug: (...args: any[]) => {
    if (canLog("debug")) console.debug(...args)
  },
  info: (...args: any[]) => {
    if (canLog("info")) console.info(...args)
  },
  warn: (...args: any[]) => {
    if (canLog("warn")) console.warn(...args)
  },
  error: (...args: any[]) => {
    if (canLog("error")) console.error(...args)
  },
}
