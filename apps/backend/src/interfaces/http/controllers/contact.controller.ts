import { Request, Response, NextFunction } from "express"
import logger from "../../../utils/logger"
import { EmailService } from "../../../application/services/email.service"

export class ContactController {
  async submitContact(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, surname, title, message, phone, captchaToken, website } = req.body

      // Honeypot field for bots
      if (website && typeof website === "string" && website.trim().length > 0) {
        return res.status(400).json({ error: "Invalid request" })
      }

      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Name is required" })
      }

      if (!surname || typeof surname !== "string" || surname.trim().length < 2) {
        return res.status(400).json({ error: "Surname is required" })
      }

      if (!title || typeof title !== "string" || title.trim().length < 3) {
        return res.status(400).json({ error: "Title is required" })
      }

      if (!message || typeof message !== "string" || message.trim().length < 10) {
        return res.status(400).json({ error: "Message is required" })
      }

      if (!captchaToken || typeof captchaToken !== "string") {
        return res.status(400).json({ error: "Captcha token is required" })
      }

      const secret = process.env.RECAPTCHA_SECRET_KEY
      if (!secret) {
        logger.error("RECAPTCHA_SECRET_KEY is not configured")
        return res.status(500).json({ error: "Captcha configuration missing" })
      }

      const verifyResponse = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret,
            response: captchaToken,
            remoteip: req.ip || "",
          }),
        }
      )

      const verifyResult = await verifyResponse.json()
      if (!verifyResult.success) {
        logger.warn("reCAPTCHA verification failed", {
          ip: req.ip,
          errors: verifyResult["error-codes"],
        })
        return res.status(400).json({ error: "Captcha verification failed" })
      }

      const emailService = new EmailService()
      const phoneLine =
        typeof phone === "string" && phone.trim().length > 0
          ? `Phone: ${phone.trim()}\n`
          : ""

      await emailService.sendContactEmail({
        to: process.env.CONTACT_EMAIL || "echatbotai@gmail.com",
        subject: `[Contact] ${title.trim()}`,
        message: `From: ${name.trim()} ${surname.trim()}\n${phoneLine}\n${message.trim()}`,
        metadata: {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      })

      res.status(200).json({ success: true })
    } catch (error) {
      logger.error("Error submitting contact form:", error)
      next(error)
    }
  }
}
