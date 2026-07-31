import { prisma, Prisma } from '@echatbot/database'

// Workspace-scoped FlowCategory CRUD (CLAUDE.md §2: every query filters by
// workspaceId). Pure DB glue — no business logic beyond ownership checks.

export interface CreateFlowCategoryInput {
  name: string
  slug: string
  description?: string
  lookupRules?: Record<string, unknown>
}

export async function listFlowCategories(workspaceId: string) {
  return prisma.flowCategory.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } })
}

export async function createFlowCategory(workspaceId: string, input: CreateFlowCategoryInput) {
  return prisma.flowCategory.create({
    data: {
      workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      lookupRules: (input.lookupRules ?? {}) as Prisma.InputJsonValue,
    },
  })
}

export async function updateFlowCategory(workspaceId: string, flowCategoryId: string, input: Partial<CreateFlowCategoryInput>) {
  const existing = await prisma.flowCategory.findFirst({ where: { id: flowCategoryId, workspaceId } })
  if (!existing) return null
  return prisma.flowCategory.update({
    where: { id: flowCategoryId },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      lookupRules: input.lookupRules as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function deleteFlowCategory(workspaceId: string, flowCategoryId: string): Promise<boolean> {
  const existing = await prisma.flowCategory.findFirst({ where: { id: flowCategoryId, workspaceId } })
  if (!existing) return false
  await prisma.flowCategory.delete({ where: { id: flowCategoryId } })
  return true
}
