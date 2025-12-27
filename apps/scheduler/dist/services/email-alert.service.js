"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendJobErrorAlert = sendJobErrorAlert;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("../utils/logger"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
async function sendJobErrorAlert(jobName, error) {
    const alertEmail = process.env.ALERT_EMAIL;
    if (!alertEmail) {
        logger_1.default.warn('ALERT_EMAIL not configured, skipping email alert');
        return;
    }
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'scheduler@echatbot.ai',
            to: alertEmail,
            subject: `🚨 [eChatbot Scheduler] Job FAILED: ${jobName}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #dc3545;">⚠️ Scheduler Job Failed</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Job Name</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${jobName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Time</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toISOString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Error</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd; color: #dc3545;">${error.message}</td>
            </tr>
          </table>
          <h3>Stack Trace:</h3>
          <pre style="background: #f8f9fa; padding: 12px; overflow-x: auto; font-size: 12px;">${error.stack}</pre>
        </div>
      `,
        });
        logger_1.default.info(`📧 Alert email sent for job: ${jobName}`);
    }
    catch (emailError) {
        logger_1.default.error(`Failed to send alert email for ${jobName}:`, emailError);
    }
}
//# sourceMappingURL=email-alert.service.js.map