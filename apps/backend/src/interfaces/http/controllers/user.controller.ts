import { NextFunction, Request, Response } from "express"
import { UserService } from "../../../application/services/user.service"

import logger from "../../../utils/logger"

export class UserController {
  private userService: UserService

  constructor(userService?: UserService) {
    this.userService = userService || new UserService()
  }

  /**
   * Get the currently authenticated user
   */
  getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
      }
      
      const user = await this.userService.getById(userId)
      
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }
      
      // Don't return the password
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        workspaceId: user.workspaceId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        authProvider: (user as any).authProvider || "email",
        hasPassword: !!(user as any).passwordHash,
      }
      
      return res.json(userWithoutPassword)
    } catch (error) {
      logger.error('Error fetching current user:', error)
      return next(error)
    }
  }

  /**
   * Get all users
   */
  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if we need to filter by workspace
      const workspaceId = req.query.workspaceId as string
      
      let users
      if (workspaceId) {
        users = await this.userService.getUsersByWorkspace(workspaceId)
      } else {
        users = await this.userService.getAllUsers()
      }
      
      // Don't return passwords
      const usersWithoutPasswords = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        workspaceId: user.workspaceId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin
      }))
      
      return res.json(usersWithoutPasswords)
    } catch (error) {
      logger.error('Error fetching users:', error)
      return next(error)
    }
  }

  /**
   * Get a specific user by ID
   */
  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      
      const user = await this.userService.getById(id)
      
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }
      
      // Don't return the password
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        workspaceId: user.workspaceId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin
      }
      
      return res.json(userWithoutPassword)
    } catch (error) {
      logger.error(`Error fetching user ${req.params.id}:`, error)
      return next(error)
    }
  }

  /**
   * Create a new user
   */
  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.body
      
      const user = await this.userService.create(userData)
      
      // Don't return the password
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        workspaceId: user.workspaceId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin
      }
      
      return res.status(201).json(userWithoutPassword)
    } catch (error) {
      logger.error('Error creating user:', error)
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({ message: error.message })
      }
      return next(error)
    }
  }

  /**
   * Update a user
   */
  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const userData = req.body
      
      logger.info(`Updating user with ID: ${id}`)
      
      const user = await this.userService.update(id, userData)
      
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }
      
      // Don't return the password
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        workspaceId: user.workspaceId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin
      }
      
      return res.json(userWithoutPassword)
    } catch (error) {
      logger.error(`Error updating user ${req.params.id}:`, error)
      return next(error)
    }
  }

  /**
   * Update current user's profile
   */
  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id
      const userData = req.body
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
      }
      
      logger.info(`Updating profile for user ID: ${userId}`)
      logger.info(`🔍 Request body received:`, JSON.stringify(userData, null, 2))
      
      const user = await this.userService.update(userId, userData)
      
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }
      
      logger.info(`✅ User updated successfully:`, {
        id: user.id,
        phoneNumber: user.phoneNumber,
        companyName: user.companyName,
        vatNumber: user.vatNumber,
        website: user.website,
        billingPhone: user.billingPhone,
        billingAddress: user.billingAddress,
      })
      
      // Don't return the password
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        workspaceId: user.workspaceId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
        // 📱 Personal phone (optional)
        phoneNumber: user.phoneNumber,
        // 🧾 Billing fields (Andrea's requirement)
        companyName: user.companyName,
        vatNumber: user.vatNumber,
        website: user.website,
        billingPhone: user.billingPhone,
        billingAddress: user.billingAddress,
      }
      
      return res.json(userWithoutPassword)
    } catch (error) {
      logger.error(`Error updating profile for user ${req.user?.id}:`, error)
      return next(error)
    }
  }

  /**
   * Change current user's password
   */
  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id
      const { currentPassword, newPassword } = req.body
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" })
      }
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" })
      }
      
      logger.info(`Changing password for user ID: ${userId}`)
      
      // Get the current user to verify the current password
      const user = await this.userService.getById(userId)
      
      if (!user) {
        return res.status(404).json({ message: "User not found" })
      }
      
      // Verify current password (use passwordHash from entity)
      const { comparePassword } = await import('../../../utils/password')
      const passwordHash = (user as any).props?.password || user.password
      
      if (!passwordHash || !(await comparePassword(currentPassword, passwordHash))) {
        return res.status(400).json({ message: "Current password is incorrect" })
      }
      
      // Update password (will be hashed by service)
      const updatedUser = await this.userService.update(userId, { password: newPassword })
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" })
      }
      
      return res.json({ message: "Password changed successfully" })
    } catch (error) {
      logger.error(`Error changing password for user ${req.user?.id}:`, error)
      return next(error)
    }
  }

  /**
   * Delete a user
   */
  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      
      const result = await this.userService.delete(id)
      
      if (!result) {
        return res.status(404).json({ message: "User not found" })
      }
      
      return res.status(204).send()
    } catch (error) {
      logger.error(`Error deleting user ${req.params.id}:`, error)
      return next(error)
    }
  }
} 