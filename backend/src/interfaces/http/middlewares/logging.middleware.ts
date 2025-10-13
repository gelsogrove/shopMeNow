import { NextFunction, Request, Response } from "express"
import logger from "../../../utils/logger"

export const loggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now()

  // Log request
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? "[REDACTED]" : undefined,
    },
    ip: req.ip,
  })

  // Capture response
  const originalSend = res.send
  res.send = function (body) {
    const responseTime = Date.now() - startTime

    // Log response
    logger.info("Outgoing response", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      size: Buffer.byteLength(body),
    })

    return originalSend.call(this, body)
  }

  next()
}

export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the request
  logger.info(`Request: ${req.method} ${req.originalUrl}`)

  // Store the original end function
  const originalEnd = res.end

  // Override the end function to log the response
  // @ts-ignore
  res.end = function (chunk?: any, encoding?: BufferEncoding, cb?: () => void) {
    logger.info(
      `Response for ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`
    )

    // Call the original end function
    return originalEnd.call(this, chunk, encoding, cb)
  }

  next()
}
