/**
 * EncryptionService
 *
 * Secure encryption/decryption for workspace credentials
 * Uses AES-256-GCM for authenticated encryption (AEAD - Authenticated Encryption with Associated Data)
 *
 * Security Features:
 * - 🔒 AES-256-GCM: Military-grade encryption with authentication
 * - 🎲 Random nonce per encryption: Prevents pattern matching attacks
 * - 🔑 Workspace-specific key: Credentials isolated per workspace
 * - ✅ Authenticated: Detects tampering with ciphertext
 *
 * @critical This service must be used for ALL credential storage
 */

import crypto from 'crypto'
import logger from '../utils/logger'

export class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly NONCE_LENGTH = 12  // 96 bits (NIST SP 800-38D recommended for GCM)
  private readonly AUTH_TAG_LENGTH = 16  // 128 bits
  private readonly ENCODING = 'hex'

  /**
   * Encrypt a secret value for a workspace
   *
   * @param plaintext - The secret to encrypt (e.g., API key)
   * @param workspaceId - Workspace ID (part of the key derivation)
   * @returns Encrypted value + nonce (combined as "base64:base64")
   */
  encrypt(plaintext: string, workspaceId: string): { encryptedValue: string; nonce: string } {
    try {
      // 1️⃣ Derive key from workspace ID + master secret
      const key = this.deriveKey(workspaceId)

      // 2️⃣ Generate random nonce (prevents pattern matching)
      const nonce = crypto.randomBytes(this.NONCE_LENGTH)

      // 3️⃣ Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, nonce)

      // 4️⃣ Encrypt
      let encryptedValue = cipher.update(plaintext, 'utf8', this.ENCODING)
      encryptedValue += cipher.final(this.ENCODING)

      // 5️⃣ Get auth tag (proves encryption wasn't tampered with)
      const authTag = cipher.getAuthTag()

      // 6️⃣ Combine ciphertext + auth tag
      const combined = encryptedValue + ':' + authTag.toString(this.ENCODING)

      logger.info('🔐 Encrypted credential for workspace', {
        workspaceId,
        valueLength: plaintext.length,
        encryptedLength: combined.length,
      })

      return {
        encryptedValue: combined,
        nonce: nonce.toString(this.ENCODING),
      }
    } catch (error) {
      logger.error('❌ Encryption failed:', error)
      throw new Error('Failed to encrypt credential')
    }
  }

  /**
   * Decrypt a secret value for a workspace
   *
   * @param encryptedValue - Encrypted value (ciphertext:authTag)
   * @param nonce - Nonce used during encryption (hex encoded)
   * @param workspaceId - Workspace ID (must match encryption key)
   * @returns Decrypted plaintext
   */
  decrypt(encryptedValue: string, nonce: string, workspaceId: string): string {
    try {
      // 1️⃣ Derive key from workspace ID (MUST match encryption key)
      const key = this.deriveKey(workspaceId)

      // 2️⃣ Reconstruct nonce from hex
      const nonceBuffer = Buffer.from(nonce, this.ENCODING)

      // 3️⃣ Split ciphertext and auth tag
      const parts = encryptedValue.split(':')
      if (parts.length !== 2 || parts[1] === undefined || parts[1] === '') {
        throw new Error('Invalid encrypted value format')
      }
      const [ciphertext, authTagHex] = parts

      const authTag = Buffer.from(authTagHex, this.ENCODING)

      // 4️⃣ Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, nonceBuffer)

      // 5️⃣ Set auth tag for verification
      decipher.setAuthTag(authTag)

      // 6️⃣ Decrypt
      let decrypted = decipher.update(ciphertext, this.ENCODING, 'utf8')
      decrypted += decipher.final('utf8')

      logger.info('🔓 Decrypted credential for workspace', {
        workspaceId,
        decryptedLength: decrypted.length,
      })

      return decrypted
    } catch (error) {
      logger.error('❌ Decryption failed:', error)

      // 🚨 SECURITY: Don't reveal why decryption failed (prevents attackers from guessing)
      throw new Error('Failed to decrypt credential - check workspaceId and nonce')
    }
  }

  /**
   * Derive a key from workspace ID + master secret
   *
   * Ensures each workspace has a unique key, but all keys are derived from
   * the same master secret (stored in environment).
   *
   * @private
   */
  private deriveKey(workspaceId: string): Buffer {
    const masterSecret = process.env.ENCRYPTION_MASTER_SECRET

    if (!masterSecret || masterSecret.length < 32) {
      logger.error('❌ ENCRYPTION_MASTER_SECRET not properly configured')
      throw new Error(
        'Encryption configuration error: ENCRYPTION_MASTER_SECRET must be set to a 32+ character string'
      )
    }

    // Use PBKDF2 to derive a workspace-specific key
    // This ensures: 1) unique key per workspace, 2) all keys from same master
    const key = crypto.pbkdf2Sync(
      masterSecret,                                  // Master secret as password
      'echatbot-workspace-encrypt:' + workspaceId,   // Workspace-specific salt (NIST compliant)
      100000,                                        // Iterations (slow = resistant to brute force)
      32,                                            // Key length (256 bits for AES-256)
      'sha256'                                       // Hash algorithm
    )

    return key
  }

  /**
   * Test encryption/decryption (for health checks)
   */
  testEncryption(workspaceId: string = 'test-workspace'): boolean {
    try {
      const plaintext = 'test-secret-12345'
      const { encryptedValue, nonce } = this.encrypt(plaintext, workspaceId)
      const decrypted = this.decrypt(encryptedValue, nonce, workspaceId)

      if (decrypted !== plaintext) {
        logger.error('❌ Encryption test failed: decrypted value does not match')
        return false
      }

      logger.info('✅ Encryption service health check passed')
      return true
    } catch (error) {
      logger.error('❌ Encryption test failed:', error)
      return false
    }
  }
}

export const encryptionService = new EncryptionService()
