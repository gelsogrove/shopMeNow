import { NextFunction, Request, Response } from "express"
import { EmailService } from "../../../application/services/email.service"
import logger from "../../../utils/logger"

// Where the inbound demo requests are delivered. Defaults to the project
// owner's inbox when REQUEST_ACCESS_EMAIL is not set in the environment.
const RECIPIENT =
  process.env.REQUEST_ACCESS_EMAIL || "gelsogrove@gmail.com"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class RequestAccessController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        name,
        email,
        company,
        industry,
        monthlyVolume,
        // Honeypot field — must stay empty. Bots fill every input they
        // see; humans never see this one because the form hides it via
        // CSS (visually & for screen readers).
        website,
      } = req.body ?? {}

      if (website && typeof website === "string" && website.trim().length > 0) {
        logger.warn("[request-access] Honeypot triggered", { ip: req.ip })
        // Pretend success so the bot doesn't learn the field name was wrong.
        return res.status(200).json({ success: true })
      }

      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Name is required" })
      }
      if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
        return res.status(400).json({ error: "Valid email is required" })
      }
      if (!company || typeof company !== "string" || company.trim().length < 2) {
        return res.status(400).json({ error: "Company is required" })
      }
      if (!industry || typeof industry !== "string" || industry.trim().length < 2) {
        return res.status(400).json({ error: "Industry is required" })
      }
      if (
        !monthlyVolume ||
        typeof monthlyVolume !== "string" ||
        monthlyVolume.trim().length < 1
      ) {
        return res
          .status(400)
          .json({ error: "Estimated monthly volume is required" })
      }

      const emailService = new EmailService()

      const subject = `[Demo request] ${company.trim()} — ${name.trim()}`
      const messageBody = [
        `New demo / access request from the public landing.`,
        ``,
        `Name:      ${name.trim()}`,
        `Email:     ${email.trim()}`,
        `Company:   ${company.trim()}`,
        `Industry:  ${industry.trim()}`,
        `Volume:    ${monthlyVolume.trim()} messages/month (estimated)`,
        ``,
        `Reply directly to ${email.trim()} to follow up.`,
      ].join("\n")

      await emailService.sendContactEmail({
        to: RECIPIENT,
        subject,
        message: messageBody,
        metadata: {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        },
      })

      logger.info("[request-access] Demo request submitted", {
        company: company.trim(),
        email: email.trim(),
        ip: req.ip,
      })

      return res.status(200).json({ success: true })
    } catch (error) {
      logger.error("[request-access] Error submitting request:", error)
      next(error)
    }
  }
}
