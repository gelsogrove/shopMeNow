import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
      return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/scheduler.log' }),
    new winston.transports.File({ filename: 'logs/scheduler-error.log', level: 'error' }),
  ],
})

export default logger
