import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
import logger from "../../../utils/logger"
import { EmailService } from "../../../application/services/email.service"

export class OnboardingQuestionnaireController {
  private emailService = new EmailService()

  /**
   * POST /questionnaire (PUBLIC — no auth)
   * Saves a new questionnaire submission and notifies the admin via email.
   */
  async submit(req: Request, res: Response): Promise<void> {
    try {
      const {
        // Contact info (optional — only if wantsContact=true)
        fullName,
        email,
        phone,
        company,
        // v2 step answers
        stepHumanSupport,
        stepPushMarketing,
        stepWidget,
        stepSalesAgents,
        stepEcommerce,
        stepEcommercePlatform,
        stepPrivacy,
        stepHelpful,
        stepOther,
        wantsContact,
      } = req.body

      // At least one step answer required
      if (!stepHumanSupport && !stepEcommerce && !stepWidget) {
        res.status(400).json({ success: false, error: "Missing required step answers" })
        return
      }

      const record = await prisma.onboardingQuestionnaire.create({
        data: {
          fullName: fullName || null,
          email: email || null,
          phone: phone || null,
          company: company || null,
          stepHumanSupport: stepHumanSupport || null,
          stepPushMarketing: stepPushMarketing || null,
          stepWidget: stepWidget || null,
          stepSalesAgents: stepSalesAgents || null,
          stepEcommerce: stepEcommerce || null,
          stepEcommercePlatform: stepEcommercePlatform || null,
          stepPrivacy: stepPrivacy || null,
          stepHelpful: stepHelpful || null,
          stepOther: stepOther || null,
          wantsContact: wantsContact === true || wantsContact === "true",
          status: "NEW",
        },
      })

      logger.info(`[QUESTIONNAIRE] New submission (id: ${record.id}, wantsContact: ${record.wantsContact})`)

      // Send admin notification (fire & forget)
      this.sendAdminNotification(record).catch((err) =>
        logger.error("[QUESTIONNAIRE] Failed to send admin notification email:", err)
      )

      res.status(201).json({ success: true, data: { id: record.id } })
    } catch (error) {
      logger.error("[QUESTIONNAIRE] Error saving submission:", error)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }

  /**
   * GET /admin/questionnaire (ADMIN — authMiddleware required)
   */
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const records = await prisma.onboardingQuestionnaire.findMany({
        orderBy: { createdAt: "desc" },
      })
      res.json({ success: true, data: records })
    } catch (error) {
      logger.error("[QUESTIONNAIRE] Error fetching submissions:", error)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }

  /**
   * PATCH /admin/questionnaire/:id/viewed (ADMIN — authMiddleware required)
   */
  async markViewed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const record = await prisma.onboardingQuestionnaire.update({
        where: { id },
        data: { status: "VIEWED" },
      })
      res.json({ success: true, data: record })
    } catch (error) {
      logger.error(`[QUESTIONNAIRE] Error marking submission ${req.params.id} as viewed:`, error)
      res.status(500).json({ success: false, error: "Internal server error" })
    }
  }

  private async sendAdminNotification(record: any): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || "admin@echatbot.ai"
    const backofficeUrl = process.env.BACKOFFICE_URL || "http://localhost:3002"

    const contactSection = record.wantsContact
      ? `<table>
      <tr><td>Full Name</td><td>${record.fullName || "—"}</td></tr>
      <tr><td>Email</td><td>${record.email || "—"}</td></tr>
      <tr><td>Phone</td><td>${record.phone || "—"}</td></tr>
      <tr><td>Company</td><td>${record.company || "—"}</td></tr>
    </table>`
      : `<p style="color:#16a34a;font-weight:bold">⚠️ User did NOT consent to be contacted.</p>`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 32px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { color: #16a34a; font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    td:first-child { color: #64748b; width: 40%; font-weight: 600; }
    .cta { display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🎯 New Questionnaire Submission</h1>
    <p class="subtitle">Received on ${new Date(record.createdAt).toLocaleString("it-IT")}</p>

    ${contactSection}

    <table>
      <tr><td>Human Support</td><td>${record.stepHumanSupport || "—"}</td></tr>
      <tr><td>Push Marketing</td><td>${record.stepPushMarketing || "—"}</td></tr>
      <tr><td>Widget</td><td>${record.stepWidget || "—"}</td></tr>
      <tr><td>Sales Agents</td><td>${record.stepSalesAgents || "—"}</td></tr>
      <tr><td>E-Commerce</td><td>${record.stepEcommerce || "—"}</td></tr>
      <tr><td>Platform</td><td>${record.stepEcommercePlatform || "—"}</td></tr>
      <tr><td>Privacy</td><td>${record.stepPrivacy || "—"}</td></tr>
      <tr><td>Will it help?</td><td>${record.stepHelpful || "—"}</td></tr>
      <tr><td>Other notes</td><td>${record.stepOther || "—"}</td></tr>
      <tr><td>Wants contact?</td><td>${record.wantsContact ? "✅ YES" : "❌ NO"}</td></tr>
    </table>

    <a href="${backofficeUrl}/questionnaire" class="cta">View in Backoffice</a>
  </div>
</body>
</html>`

    await this.emailService.sendContactEmail({
      to: adminEmail,
      subject: `[eChatbot] New questionnaire from ${record.fullName || "anonymous"}`,
      message: html,
    })
  }
}
