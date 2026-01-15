import crypto from "crypto"
import logger from "./logger"

const DEFAULT_ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

const getEncryptionKey = (): Buffer => {
  const key =
    process.env.PAYPAL_TOKEN_ENCRYPTION_KEY ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    ""

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PAYPAL_TOKEN_ENCRYPTION_KEY must be set in production")
    }
    logger.warn(
      "PAYPAL_TOKEN_ENCRYPTION_KEY not set - using JWT_SECRET for dev only"
    )
    return crypto
      .createHash("sha256")
      .update(process.env.JWT_SECRET || "dev-only")
      .digest()
  }

  if (key.length >= 32) {
    return crypto.createHash("sha256").update(key).digest()
  }

  return crypto.createHash("sha256").update(key).digest()
}

export const encryptSecret = (value: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv(DEFAULT_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

export const decryptSecret = (payload: string): string => {
  const [ivB64, tagB64, dataB64] = payload.split(":")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format")
  }
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const data = Buffer.from(dataB64, "base64")
  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv(DEFAULT_ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString("utf8")
}
