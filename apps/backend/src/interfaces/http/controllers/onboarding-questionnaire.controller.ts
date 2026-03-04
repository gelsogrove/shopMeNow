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
        fullName,
        email,
        phone,
        company,
        stepChannel,
        stepTimeSaving,
        stepEcommerce,
        stepDocuments,
        stepIntegration,
        stepHandoff,
        stepMarketing,
      } = req.body

      // Basic validation
      if (!fullName || !email || !stepChannel || !stepTimeSaving || !stepEcommerce || !stepDocuments || !stepIntegration || !stepHandoff || !stepMarketing) {
        res.status(400).json({ success: false, error: "Missing required fields" })
        return
      }

      const record = await prisma.onboardingQuestionnaire.create({
        data: {
          fullName,
          email,
          phone: phone || null,
          company: company || null,
          stepChannel,
          stepTimeSaving,
          stepEcommerce,
          stepDocuments,
          stepIntegration,
          stepHandoff,
          stepMarketing,
          status: "NEW",
        },
      })

      logger.info(`[QUESTIONNAIRE] New submission from ${email} (id: ${record.id})`)

      // Send admin notification email (fire & forget — don't fail the response on email error)
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
   * Returns all questionnaire submissions ordered by createdAt desc.
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
   * Marks a submission as VIEWED.
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

  private async sendAdminNotification(record: {
    id: string
    fullName: string
    email: string
    phone: string | null
    company: string | null
    stepChannel: string
    stepTimeSaving: string
    stepEcommerce: string
    stepDocuments: string
    stepIntegration: string
    stepHandoff: string
    stepMarketing: string
    createdAt: Date
  }): Promise<void> {
    const adminEmail =
      process.env.ADMIN_EMAIL ||
      process.env.SMTP_FROM ||
      "admin@echatbot.ai"

    const backofficeUrl =
      process.env.BACKOFFICE_URL || "http://localhost:3002"

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

    <table>
      <tr><td>Full Name</td><td>${record.fullName}</td></tr>
      <tr><td>Email</td><td>${record.email}</td></tr>
      <tr><td>Phone</td><td>${record.phone || "—"}</td></tr>
      <tr><td>Company</td><td>${record.company || "—"}</td></tr>
    </table>

    <table>
      <tr><td>Channel preference</td><td>${record.stepChannel}</td></tr>
      <tr><td>Time saving goal</td><td>${record.stepTimeSaving}</td></tr>
      <tr><td>Automated sales</td><td>${record.stepEcommerce}</td></tr>
      <tr><td>Document management</td><td>${record.stepDocuments}</td></tr>
      <tr><td>Live integrations</td><td>${record.stepIntegration}</td></tr>
      <tr><td>Handoff preference</td><td>${record.stepHandoff}</td></tr>
      <tr><td>AI marketing</td><td>${record.stepMarketing}</td></tr>
    </table>

    <a href="${backofficeUrl}/questionnaire" class="cta">View in Backoffice</a>
  </div>
</body>
</html>`

    await this.emailService.sendContactEmail({
      to: adminEmail,
      subject: `[eChatbot] New questionnaire from ${record.fullName}`,
      message: html,
    })
  }
}
