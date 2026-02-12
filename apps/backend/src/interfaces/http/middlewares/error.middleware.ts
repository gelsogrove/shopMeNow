import { NextFunction, Request, Response } from "express"
import logger from "../../../utils/logger"

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = "AppError"
    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error("Error:", err)

  // Feature flag (default ON): show real errors to clients when true.
  // Set SHOW_ERRORS=false (env/backoffice toggle) to always return generic internal error.
  const showErrors = (process.env.SHOW_ERRORS ?? "true").toLowerCase() !== "false"

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: showErrors ? err.message : "Internal server error",
    })
    return
  }

  res.status(500).json({
    status: "error",
    message: showErrors && err?.message ? err.message : "Internal server error",
    ...(showErrors && (err as any)?.code ? { code: (err as any).code } : {}),
  })
}
