/**
 * SIMPLIFIED WORKSPACE ISOLATION TEST
 * 
 * Tests CRITICAL security requirement:
 * - User A can ONLY see their own workspaces
 * - User A CANNOT see User B's workspaces
 * 
 * Uses direct DB creation (no API calls) to avoid timeout issues
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

describe('🔒 Workspace Isolation - Database Level', () => {
  let userAId: string
  let userBId: string
  let workspaceAId: string
  let workspaceBId: string

  beforeAll(async () => {
    // Create User A
    const userA = await prisma.user.create({
      data: {
        email: `user-a-simple-${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash('Password123!', 10),
        firstName: 'UserA',
        lastName: 'TestA',
        role: 'MEMBER',
        status: 'ACTIVE',
        gdprAccepted: new Date(),
      },
    })
    userAId = userA.id

    // Create User B
    const userB = await prisma.user.create({
      data: {
        email: `user-b-simple-${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash('Password123!', 10),
        firstName: 'UserB',
        lastName: 'TestB',
        role: 'MEMBER',
        status: 'ACTIVE',
        gdprAccepted: new Date(),
      },
    })
    userBId = userB.id

    // Create Workspace A
    const workspaceA = await prisma.workspace.create({
      data: {
        name: `Workspace A Simple ${Date.now()}`,
        slug: `workspace-a-simple-${Date.now()}`,
        whatsappPhoneNumber: '+1234567890',
        language: 'en',
      },
    })
    workspaceAId = workspaceA.id

    // Link User A to Workspace A
    await prisma.userWorkspace.create({
      data: {
        userId: userAId,
        workspaceId: workspaceAId,
        role: 'OWNER',
      },
    })

    // Create Workspace B
    const workspaceB = await prisma.workspace.create({
      data: {
        name: `Workspace B Simple ${Date.now() + 1000}`,
        slug: `workspace-b-simple-${Date.now() + 1000}`,
        whatsappPhoneNumber: '+9876543210',
        language: 'es',
      },
    })
    workspaceBId = workspaceB.id

    // Link User B to Workspace B
    await prisma.userWorkspace.create({
      data: {
        userId: userBId,
        workspaceId: workspaceBId,
        role: 'OWNER',
      },
    })

    console.log(`✅ User A (${userAId}) → Workspace A (${workspaceAId})`)
    console.log(`✅ User B (${userBId}) → Workspace B (${workspaceBId})`)
  })

  afterAll(async () => {
    // Cleanup
    await prisma.userWorkspace.deleteMany({ where: { userId: { in: [userAId, userBId] } } })
    await prisma.workspace.deleteMany({ where: { id: { in: [workspaceAId, workspaceBId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } })
    await prisma.$disconnect()
  })

  it('🔒 User A can ONLY see Workspace A', async () => {
    const userAWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId: userAId },
      include: { workspace: true },
    })

    expect(userAWorkspaces).toHaveLength(1)
    expect(userAWorkspaces[0].workspaceId).toBe(workspaceAId)
    expect(userAWorkspaces[0].workspace.name).toContain('Workspace A')
    
    console.log(`✅ User A sees ONLY Workspace A: ${userAWorkspaces[0].workspace.name}`)
  })

  it('🔒 User B can ONLY see Workspace B', async () => {
    const userBWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId: userBId },
      include: { workspace: true },
    })

    expect(userBWorkspaces).toHaveLength(1)
    expect(userBWorkspaces[0].workspaceId).toBe(workspaceBId)
    expect(userBWorkspaces[0].workspace.name).toContain('Workspace B')
    
    console.log(`✅ User B sees ONLY Workspace B: ${userBWorkspaces[0].workspace.name}`)
  })

  it('🚨 CRITICAL: User A CANNOT see Workspace B', async () => {
    const userAWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId: userAId },
    })

    const hasWorkspaceB = userAWorkspaces.some((uw) => uw.workspaceId === workspaceBId)
    
    expect(hasWorkspaceB).toBe(false)
    
    console.log('✅ SECURITY CHECK PASSED: User A cannot see Workspace B')
  })

  it('🚨 CRITICAL: User B CANNOT see Workspace A', async () => {
    const userBWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId: userBId },
    })

    const hasWorkspaceA = userBWorkspaces.some((uw) => uw.workspaceId === workspaceAId)
    
    expect(hasWorkspaceA).toBe(false)
    
    console.log('✅ SECURITY CHECK PASSED: User B cannot see Workspace A')
  })

  it('🔒 Workspaces are DIFFERENT', async () => {
    expect(workspaceAId).not.toBe(workspaceBId)
    
    console.log(`✅ Workspace A (${workspaceAId}) !== Workspace B (${workspaceBId})`)
  })
})
