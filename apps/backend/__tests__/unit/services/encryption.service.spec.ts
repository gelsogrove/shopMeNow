/**
 * Encryption Service Security Tests
 *
 * Tests for:
 * - Correct encryption/decryption cycle
 * - Workspace isolation (workspace A cant decrypt workspace B's data)
 * - Nonce randomness (same plaintext → different ciphertext)
 * - Authentication tag validation (tampering detection)
 * - Health check
 */

// RULE: Set test encryption secret before module loads (env var required by service)
process.env.ENCRYPTION_MASTER_SECRET = 'test-encryption-master-secret-must-be-32-chars-long'

import { encryptionService } from '../../../src/services/encryption.service'

describe('EncryptionService Security', () => {
  const workspaceA = 'workspace-a-id'
  const workspaceB = 'workspace-b-id'
  const plaintext = 'sk_live_1234567890abcdef'

  describe('Encryption & Decryption', () => {
    it('should encrypt plaintext to different ciphertext on each call (nonce randomness)', () => {
      const result1 = encryptionService.encrypt(plaintext, workspaceA)
      const result2 = encryptionService.encrypt(plaintext, workspaceA)

      // Same plaintext, different encrypted values (due to random nonce)
      expect(result1.encryptedValue).not.toEqual(result2.encryptedValue)
      expect(result1.nonce).not.toEqual(result2.nonce)
    })

    it('should correctly decrypt encrypted value with matching nonce and workspace', () => {
      const encrypted = encryptionService.encrypt(plaintext, workspaceA)
      const decrypted = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)

      expect(decrypted).toEqual(plaintext)
    })

    it('should handle long credential values', () => {
      const longPlaintext = 'x'.repeat(5000)
      const encrypted = encryptionService.encrypt(longPlaintext, workspaceA)
      const decrypted = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)

      expect(decrypted).toEqual(longPlaintext)
    })
  })

  describe('Workspace Isolation', () => {
    it('should NOT decrypt when using wrong workspace ID', () => {
      const encrypted = encryptionService.encrypt(plaintext, workspaceA)

      // Try to decrypt with workspace B - should fail
      expect(() => {
        encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceB)
      }).toThrow()
    })

    it('should create different encryption keys for different workspaces', () => {
      // Same plaintext, different workspaces
      const resultA = encryptionService.encrypt(plaintext, workspaceA)
      const resultB = encryptionService.encrypt(plaintext, workspaceB)

      // Different ciphertexts (even ignoring nonce randomness)
      expect(resultA.encryptedValue).not.toEqual(resultB.encryptedValue)

      // Workspace B cannot decrypt workspace A's value
      expect(() => {
        encryptionService.decrypt(resultA.encryptedValue, resultA.nonce, workspaceB)
      }).toThrow()
    })

    it('should enforce workspace isolation across multiple credentials', () => {
      const creds = [
        { text: 'api_key_1', workspace: workspaceA },
        { text: 'api_key_2', workspace: workspaceA },
        { text: 'api_key_3', workspace: workspaceB },
      ]

      const encrypted = creds.map(c => ({
        ...c,
        enc: encryptionService.encrypt(c.text, c.workspace)
      }))

      // WorkspaceA should decrypt its credentials
      expect(encryptionService.decrypt(
        encrypted[0].enc.encryptedValue,
        encrypted[0].enc.nonce,
        workspaceA
      )).toEqual('api_key_1')

      expect(encryptionService.decrypt(
        encrypted[1].enc.encryptedValue,
        encrypted[1].enc.nonce,
        workspaceA
      )).toEqual('api_key_2')

      // WorkspaceA should NOT decrypt workspaceB's credential
      expect(() => {
        encryptionService.decrypt(
          encrypted[2].enc.encryptedValue,
          encrypted[2].enc.nonce,
          workspaceA
        )
      }).toThrow()

      // WorkspaceB should decrypt its credential
      expect(encryptionService.decrypt(
        encrypted[2].enc.encryptedValue,
        encrypted[2].enc.nonce,
        workspaceB
      )).toEqual('api_key_3')

      // WorkspaceB should NOT decrypt workspaceA's credentials
      expect(() => {
        encryptionService.decrypt(
          encrypted[0].enc.encryptedValue,
          encrypted[0].enc.nonce,
          workspaceB
        )
      }).toThrow()
    })
  })

  describe('Authentication Tag Validation', () => {
    it('should detect tampering with encrypted value', () => {
      const encrypted = encryptionService.encrypt(plaintext, workspaceA)

      // Tamper with the encrypted value (flip a bit)
      const tamperedValue = encrypted.encryptedValue.split('').map((c, i) => {
        if (i === 0) return String.fromCharCode(c.charCodeAt(0) ^ 1)
        return c
      }).join('')

      // Should throw due to authentication tag validation failure
      expect(() => {
        encryptionService.decrypt(tamperedValue, encrypted.nonce, workspaceA)
      }).toThrow()
    })

    it('should detect tampering with nonce', () => {
      const encrypted = encryptionService.encrypt(plaintext, workspaceA)

      // Tamper with the nonce (flip a bit)
      const tamperedNonce = encrypted.nonce.split('').map((c, i) => {
        if (i === 0) return String.fromCharCode(c.charCodeAt(0) ^ 1)
        return c
      }).join('')

      // Should throw due to authentication tag validation failure
      expect(() => {
        encryptionService.decrypt(encrypted.encryptedValue, tamperedNonce, workspaceA)
      }).toThrow()
    })
  })

  describe('Health Check', () => {
    it('should return true on successful health check', () => {
      const result = encryptionService.testEncryption()
      expect(result).toBe(true)
    })

    it('should return true on successful workspace-specific health check', () => {
      const result = encryptionService.testEncryption(workspaceA)
      expect(result).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string credentials', () => {
      // Although we validate on API level, encryption should handle it
      const encrypted = encryptionService.encrypt('', workspaceA)
      const decrypted = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)
      expect(decrypted).toEqual('')
    })

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
      const encrypted = encryptionService.encrypt(specialChars, workspaceA)
      const decrypted = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)
      expect(decrypted).toEqual(specialChars)
    })

    it('should handle unicode characters', () => {
      const unicode = '你好世界🔐🔑🎯'
      const encrypted = encryptionService.encrypt(unicode, workspaceA)
      const decrypted = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)
      expect(decrypted).toEqual(unicode)
    })

    it('should handle very long nonce/ciphertext base64 strings', () => {
      const longPlaintext = 'x'.repeat(10000)
      const encrypted = encryptionService.encrypt(longPlaintext, workspaceA)

      // Verify nonce and ciphertext are valid base64
      expect(() => {
        Buffer.from(encrypted.nonce, 'base64')
      }).not.toThrow()

      expect(() => {
        Buffer.from(encrypted.encryptedValue, 'base64')
      }).not.toThrow()

      // Verify decryption works
      const decrypted = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)
      expect(decrypted).toEqual(longPlaintext)
    })
  })

  describe('Consistency', () => {
    it('should consistently decrypt the same encrypted value multiple times', () => {
      const encrypted = encryptionService.encrypt(plaintext, workspaceA)

      const decrypted1 = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)
      const decrypted2 = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)
      const decrypted3 = encryptionService.decrypt(encrypted.encryptedValue, encrypted.nonce, workspaceA)

      expect(decrypted1).toEqual(decrypted2)
      expect(decrypted2).toEqual(decrypted3)
      expect(decrypted1).toEqual(plaintext)
    })
  })
})
