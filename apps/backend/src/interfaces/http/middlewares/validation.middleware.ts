import { NextFunction, Request, Response } from "express"
import { z } from "zod"
import { AppError } from "./error.middleware"

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
    ),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  gdprAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the GDPR terms",
  }),
})

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
    ),
})

const otpSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  otp: z.string().length(6, "OTP must be 6 digits"),
})

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    registerSchema.parse(req.body)
    next()
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, error.errors[0].message)
    }
    next(error)
  }
}

export const validateForgotPassword = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    forgotPasswordSchema.parse(req.body)
    next()
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, error.errors[0].message)
    }
    next(error)
  }
}

export const validateResetPassword = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    resetPasswordSchema.parse(req.body)
    next()
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, error.errors[0].message)
    }
    next(error)
  }
}

export const validateOtp = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    otpSchema.parse(req.body)
    next()
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, error.errors[0].message)
    }
    next(error)
  }
}
