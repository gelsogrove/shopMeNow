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

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    })
    return
  }

  // For non-AppError, expose minimal debug to help troubleshooting (no stack)
  const payload: any = {
    status: "error",
    message: "Internal server error",
  }

  // If the error has a known code/message, surface it to speed up debugging (trusted admin UI)
  if (err && (err as any).message) {
    payload.debug = {
      message: (err as any).message,
      code: (err as any).code,
    }
  }

  res.status(500).json(payload)
}
