/**
 * Script to fix OAuth user with missing 2FA setup
 * Deletes user gelsogrove@gmail.com so they can register again
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixOAuthUser() {
  try {
    console.log('🔍 Looking for user gelsogrove@gmail.com...')
    
    const user = await prisma.user.findUnique({
      where: { email: 'gelsogrove@gmail.com' },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    })

    if (!user) {
      console.log('✅ User not found - nothing to fix')
      return
    }

    console.log('📋 User found:', {
      id: user.id,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      has2FASecret: !!user.twoFactorSecret,
    })

    if (!user.twoFactorSecret || !user.twoFactorEnabled) {
      console.log('🗑️ Deleting user with incomplete 2FA setup...')
      
      await prisma.user.delete({
        where: { id: user.id },
      })
      
      console.log('✅ User deleted successfully! You can now register again with Google.')
    } else {
      console.log('✅ User has complete 2FA setup - no action needed')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixOAuthUser()
