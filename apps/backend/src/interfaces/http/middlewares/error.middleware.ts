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

  res.status(500).json({
    status: "error",
    message: "Internal server error",
  })
}
