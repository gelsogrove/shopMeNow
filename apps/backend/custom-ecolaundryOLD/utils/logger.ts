// Tiny zero-dep structured logger. JSON lines in production (LOG_FORMAT=json
// or NODE_ENV=production), human-readable in development. Drop-in: import
// `logger` and call `logger.info/warn/error(message, context?)`.

import process from 'node:process'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
const useJson =
  process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel]
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout
  if (useJson) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...(context || {}),
    }
    stream.write(`${JSON.stringify(payload)}\n`)
    return
  }
  const ctx = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : ''
  stream.write(`[${level.toUpperCase()}] ${message}${ctx}\n`)
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
}
