/**
 * SMTP Test Script
 *
 * Purpose: Verify SMTP configuration before implementing sendMail() function
 * Usage: npm run test:smtp
 *
 * This script:
 * 1. Loads SMTP environment variables
 * 2. Creates a nodemailer transporter
 * 3. Sends a test email to SMTP_USER address
 * 4. Reports success/failure with detailed error messages
 */

import dotenv from "dotenv"
import nodemailer from "nodemailer"
import path from "path"

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") })

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

/**
 * Validate that all required SMTP environment variables are present
 */
function validateSmtpConfig(): SmtpConfig {
  const requiredVars = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_FROM",
  ]
  const missing: string[] = []

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required SMTP environment variables: ${missing.join(", ")}`
    )
  }

  return {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT!, 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS || "", // Optional for servers without auth
    from: process.env.SMTP_FROM!,
  }
}

/**
 * Send test email using nodemailer
 */
async function sendTestEmail(config: SmtpConfig): Promise<void> {
  console.log("📧 Creating SMTP transporter...")
  console.log(`   Host: ${config.host}`)
  console.log(`   Port: ${config.port}`)
  console.log(`   Secure: ${config.secure}`)
  console.log(`   User: ${config.user}`)
  console.log("")

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  console.log("✅ Transporter created successfully")
  console.log("")

  console.log("🔍 Verifying SMTP connection...")
  await transporter.verify()
  console.log("✅ SMTP connection verified...")
  console.log("")

  console.log(`📨 Sending test email to ${config.user}...`)

  const testDate = new Date().toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
  })

  const info = await transporter.sendMail({
    from: `"ShopME Test" <${config.from}>`,
    to: "getprono@gmail.com",
    subject: "✅ SMTP Test - ShopME Email System",
    text: `Questo è un test del sistema email di ShopME....

Data/Ora: ${testDate}
Server SMTP: ${config.host}:${config.port}
Secure: ${config.secure}

Se ricevi questa email, la configurazione SMTP funziona correttamente! 🎉

Prossimi passi:
1. ✅ SMTP configurato e funzionante
2. ⏳ Implementare sendMail() in EmailService
3. ⏳ Integrare nei punti di trigger (ContactOperator, Order creation)

---
ShopME Email Notification System
`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">✅ SMTP Test - ShopME Email System</h2>
        
        <p>Questo è un test del sistema email di ShopME.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Data/Ora</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${testDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Server SMTP</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${config.host}:${config.port}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Secure</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${config.secure}</td>
          </tr>
        </table>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Se ricevi questa email, la configurazione SMTP funziona correttamente! 🎉</strong></p>
        </div>
        
        <h3>Prossimi passi:</h3>
        <ol>
          <li>✅ SMTP configurato e funzionante</li>
          <li>⏳ Implementare sendMail() in EmailService</li>
          <li>⏳ Integrare nei punti di trigger (ContactOperator, Order creation)</li>
        </ol>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px; text-align: center;">ShopME Email Notification System</p>
      </div>
    `,
  })

  console.log("✅ Test email sent successfully!")
  console.log("")
  console.log("📬 Email details:")
  console.log(`   Message ID: ${info.messageId}`)
  console.log(`   From: ${config.from}`)
  console.log(`   To: ${config.user}`)
  console.log(`   Response: ${info.response}`)
  console.log("")
  console.log("🎉 SMTP test completed successfully!")
  console.log("📧 Check your inbox at:", config.user)
}

/**
 * Main function
 */
async function main() {
  console.log("")
  console.log("=".repeat(60))
  console.log("🧪 SMTP Configuration Test - ShopME Email System")
  console.log("=".repeat(60))
  console.log("")

  try {
    // Step 1: Validate environment variables
    console.log("📋 Step 1: Validating SMTP configuration...")
    const config = validateSmtpConfig()
    console.log("✅ All required SMTP variables found")
    console.log("")

    // Step 2: Send test email
    console.log("📋 Step 2: Sending test email...")
    await sendTestEmail(config)

    console.log("")
    console.log("=".repeat(60))
    console.log("✅ TEST PASSED - SMTP is working correctly!")
    console.log("=".repeat(60))
    console.log("")

    process.exit(0)
  } catch (error) {
    console.error("")
    console.error("=".repeat(60))
    console.error("❌ TEST FAILED - SMTP configuration error")
    console.error("=".repeat(60))
    console.error("")

    if (error instanceof Error) {
      console.error("Error:", error.message)

      // Provide helpful troubleshooting tips
      console.error("")
      console.error("🔧 Troubleshooting tips:")
      console.error("")

      if (error.message.includes("Missing required")) {
        console.error(
          "  1. Check that all SMTP_* variables are set in backend/.env"
        )
        console.error("  2. Make sure .env file exists and is readable")
        console.error("")
      } else if (
        error.message.includes("EAUTH") ||
        error.message.includes("authentication")
      ) {
        console.error("  1. For Gmail: use App Password, not regular password")
        console.error(
          "  2. Generate App Password: https://myaccount.google.com/apppasswords"
        )
        console.error("  3. Enable 2FA on your Google account first")
        console.error("  4. Verify SMTP_USER and SMTP_PASS are correct")
        console.error("")
      } else if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("connect")
      ) {
        console.error("  1. Check SMTP_HOST is correct (e.g., smtp.gmail.com)")
        console.error("  2. Verify SMTP_PORT (465 for secure, 587 for TLS)")
        console.error("  3. Check firewall/network settings")
        console.error("")
      } else if (
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("timeout")
      ) {
        console.error("  1. SMTP server might be blocking the connection")
        console.error("  2. Try different port (465 or 587)")
        console.error("  3. Check if SMTP_SECURE matches the port")
        console.error("")
      }

      console.error("Full error details:")
      console.error(error)
    } else {
      console.error("Unknown error:", error)
    }

    console.error("")
    process.exit(1)
  }
}

// Run the test
main()
