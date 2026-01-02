import { describe, it, expect } from 'vitest'
import { z } from 'zod'

/**
 * Test suite for login and registration form validation schemas
 * These tests verify that Zod schemas correctly validate user input
 */
describe('Form Validation Schemas', () => {
  describe('Login Schema', () => {
    const loginSchema = z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(1, "Password is required"),
    })

    it('should validate correct login credentials', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      }

      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
      }

      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid email address')
      }
    })

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      }

      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password is required')
      }
    })
  })

  describe('Registration Schema', () => {
    const registerSchema = z.object({
      email: z.string().email("Invalid email address"),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
      confirmPassword: z.string(),
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      gdprAccepted: z.boolean(),
    }).refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }).refine((data) => data.gdprAccepted === true, {
      message: "You must accept the terms",
      path: ["gdprAccepted"],
    })

    it('should validate complete registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject password shorter than 8 characters', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Pass1!',
        confirmPassword: 'Pass1!',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must be at least 8 characters')
      }
    })

    it('should reject password without uppercase letter', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123!',
        confirmPassword: 'password123!',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must contain at least one uppercase letter')
      }
    })

    it('should reject password without lowercase letter', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'PASSWORD123!',
        confirmPassword: 'PASSWORD123!',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must contain at least one lowercase letter')
      }
    })

    it('should reject password without number', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password!',
        confirmPassword: 'Password!',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must contain at least one number')
      }
    })

    it('should reject password without special character', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must contain at least one special character')
      }
    })

    it('should reject mismatched passwords', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPass123!',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        const confirmError = result.error.errors.find(e => e.path[0] === 'confirmPassword')
        expect(confirmError?.message).toBe("Passwords don't match")
      }
    })

    it('should reject when GDPR is not accepted', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        gdprAccepted: false,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        const gdprError = result.error.errors.find(e => e.path[0] === 'gdprAccepted')
        expect(gdprError?.message).toBe('You must accept the terms')
      }
    })

    it('should reject empty first name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: '',
        lastName: 'Doe',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('First name is required')
      }
    })

    it('should reject empty last name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        firstName: 'John',
        lastName: '',
        gdprAccepted: true,
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Last name is required')
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle email with special characters', () => {
      const loginSchema = z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      })

      const validData = {
        email: 'test+tag@example.co.uk',
        password: 'password',
      }

      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should trim whitespace from email', () => {
      const loginSchema = z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      })

      const dataWithSpaces = {
        email: '  test@example.com  ',
        password: 'password',
      }

      // Zod doesn't trim by default, so this should fail
      const result = loginSchema.safeParse(dataWithSpaces)
      expect(result.success).toBe(false)
    })
  })
})
