import { PrismaClient } from "@echatbot/database"
import * as speakeasy from "speakeasy"
import { AppError } from "../../interfaces/http/middlewares/error.middleware"
import logger from "../../utils/logger"

export class OtpService {
  constructor(private readonly prisma: PrismaClient) {}

  async setupTwoFactor(userId: string): Promise<string> {
    // Get user email for QR code label
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (!user) {
      throw new AppError(404, "User not found")
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `eChatbot:${user.email}`, // Format: "eChatbot:email@example.com"
      issuer: "eChatbot", // This is what appears as app name in authenticator
      length: 32,
    })

    // Save secret to user
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    })

    // Return otpauth URL directly (NOT data URL)
    const otpauthUrl = secret.otpauth_url
    if (!otpauthUrl) {
      throw new AppError(500, "Failed to generate OTP auth URL")
    }

    return otpauthUrl
  }

  async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    // Get user's secret
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, email: true },
    })

    if (!user?.twoFactorSecret) {
      throw new AppError(400, "2FA not set up for this user")
    }

    // Verify token with extended window for time drift
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: token,
      window: 2, // Allow 2 steps (60 seconds) before/after for time drift
    })

    logger.debug(`[2FA Verify] userId=${userId}, isValid=${isValid}`)

    return isValid
  }

  /**
   * ⚠️ DEPRECATED: otpToken table was removed during database cleanup
   * Use setupTwoFactor/verifyTwoFactor instead for 2FA functionality
   */
  async generateOtp(userId: string): Promise<string> {
    throw new AppError(
      501,
      "OTP generation is no longer supported. Use 2FA instead."
    )
    /*
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // Hash the OTP before storing
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex")

    // Store the OTP
    await this.prisma.otpToken.create({
      data: {
        userId,
        otpHash,
        expiresAt,
      },
    })

    return otp
    */
  }

  /**
   * ⚠️ DEPRECATED: otpToken table was removed during database cleanup
   * Use setupTwoFactor/verifyTwoFactor instead for 2FA functionality
   */
  async verifyOtp(userId: string, otp: string): Promise<boolean> {
    throw new AppError(
      501,
      "OTP verification is no longer supported. Use 2FA instead."
    )
    /*
    // Hash the provided OTP
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex")

    // Find valid OTP
    const validOtp = await this.prisma.otpToken.findFirst({
      where: {
        userId,
        otpHash,
        expiresAt: {
          gt: new Date(),
        },
        usedAt: null,
      },
    })

    if (!validOtp) {
      return false
    }

    // Mark OTP as used
    await this.prisma.otpToken.update({
      where: { id: validOtp.id },
      data: { usedAt: new Date() },
    })

    return true
    */
  }

  /**
   * ⚠️ DEPRECATED: otpToken table was removed during database cleanup
   */
  async cleanupExpiredOtps(): Promise<void> {
    // No-op: table no longer exists
    /*
    await this.prisma.otpToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    })
    */
  }
}
