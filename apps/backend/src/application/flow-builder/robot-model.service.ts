import { prisma, Prisma } from '@echatbot/database'

// Workspace-scoped RobotModel CRUD (CLAUDE.md §2: every query filters by
// workspaceId). Pure DB glue — no business logic beyond ownership checks.

export interface CreateRobotModelInput {
  name: string
  slug: string
  manufacturer?: string
  description?: string
  lookupRules?: Record<string, unknown>
}

export async function listRobotModels(workspaceId: string) {
  return prisma.robotModel.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } })
}

export async function createRobotModel(workspaceId: string, input: CreateRobotModelInput) {
  return prisma.robotModel.create({
    data: {
      workspaceId,
      name: input.name,
      slug: input.slug,
      manufacturer: input.manufacturer,
      description: input.description,
      lookupRules: (input.lookupRules ?? {}) as Prisma.InputJsonValue,
    },
  })
}

export async function updateRobotModel(workspaceId: string, robotModelId: string, input: Partial<CreateRobotModelInput>) {
  const existing = await prisma.robotModel.findFirst({ where: { id: robotModelId, workspaceId } })
  if (!existing) return null
  return prisma.robotModel.update({
    where: { id: robotModelId },
    data: {
      name: input.name,
      slug: input.slug,
      manufacturer: input.manufacturer,
      description: input.description,
      lookupRules: input.lookupRules as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function deleteRobotModel(workspaceId: string, robotModelId: string): Promise<boolean> {
  const existing = await prisma.robotModel.findFirst({ where: { id: robotModelId, workspaceId } })
  if (!existing) return false
  await prisma.robotModel.delete({ where: { id: robotModelId } })
  return true
}
