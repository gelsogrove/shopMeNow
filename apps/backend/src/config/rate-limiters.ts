/**
 * Rate Limiters Configuration
 *
 * Protects critical public endpoints from abuse, DoS attacks, and brute force attempts.
 * Each limiter is configured based on the endpoint's expected usage pattern.
 */

import rateLimit from "express-rate-limit"
import logger from "../utils/logger"

/**
 * Webhook WhatsApp - Protezione DoS
 *
 * Prevents spam/DoS attacks on webhook endpoint.
 * Allows 10 requests per minute per IP address.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 richieste per IP
  message: "Too many webhook requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded for webhook", {
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: 60,
    })
  },
})

/**
 * Public Orders - Protezione brute force token
 *
 * Prevents brute force attacks on secure tokens.
 * Allows 30 requests per 15 minutes per IP (2 per minute).
 */
export const publicOrdersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 30, // 30 richieste per IP
  message: "Too many order requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded for public orders", {
      ip: req.ip,
      path: req.path,
      token: req.query.token ? "present" : "missing",
    })
    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again in 15 minutes.",
      retryAfter: 900,
    })
  },
})

/**
 * Checkout - Protezione spam ordini
 *
 * Prevents spam order creation.
 * Allows 20 orders per hour per IP.
 */
export const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 20, // 20 ordini per IP all'ora
  message: "Too many checkout attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded for checkout", {
      ip: req.ip,
      path: req.path,
      customerId: req.body?.customerId,
    })
    res.status(429).json({
      error: "Too many requests",
      message: "Too many checkout attempts. Please try again in 1 hour.",
      retryAfter: 3600,
    })
  },
})

/**
 * Registration - Protezione account creation spam
 *
 * Prevents mass account creation spam.
 * Allows 5 registrations per hour per IP.
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 5, // 5 registrazioni per IP all'ora
  message: "Too many registration attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts
  handler: (req, res) => {
    logger.warn("Rate limit exceeded for registration", {
      ip: req.ip,
      path: req.path,
      email: req.body?.email,
    })
    res.status(429).json({
      error: "Too many requests",
      message: "Too many registration attempts. Please try again in 1 hour.",
      retryAfter: 3600,
    })
  },
})

/**
 * Cart Operations - Protezione cart manipulation
 *
 * Prevents rapid cart manipulation abuse.
 * Allows 30 operations per minute per IP.
 */
export const cartLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: process.env.NODE_ENV === "development" ? 500 : 30, // 500 in dev, 30 in prod
  message: "Too many cart operations, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded for cart operations", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    })
    res.status(429).json({
      error: "Too many requests",
      message: "Too many cart operations. Please slow down.",
      retryAfter: 60,
    })
  },
})

/**
 * Feedback - Protezione spam feedback
 *
 * Prevents spam feedback submissions.
 * Allows 5 feedbacks per 15 minutes per IP.
 */
export const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // 5 feedback per IP
  message: "Too many feedback submissions, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded for feedback", {
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: "Too many requests",
      message: "Too many feedback submissions. Please try again in 15 minutes.",
      retryAfter: 900,
    })
  },
})

/**
 * Cart Token - Protezione generazione token
 *
 * Prevents cart token abuse.
 * Allows 10 token operations per minute per IP.
 */
export const cartTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 operazioni al minuto
  message: "Too many cart token requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded for cart token", {
      ip: req.ip,
      path: req.path,
    })
    res.status(429).json({
      error: "Too many requests",
      message: "Too many cart token requests. Please slow down.",
      retryAfter: 60,
    })
  },
})

/**
 * General API Rate Limiter
 *
 * Fallback rate limiter for all API endpoints.
 * Allows 100 requests per minute per IP.
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 richieste al minuto
  message: "Too many API requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("General API rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    })
    res.status(429).json({
      error: "Too many requests",
      message: "API rate limit exceeded. Please slow down.",
      retryAfter: 60,
    })
  },
})
