import { prisma } from '@echatbot/database'
import { storageService } from '../../services/storage.service'

// Asset upload: reuses the existing storageService (Cloudinary in
// production, local filesystem in dev) rather than inventing a new storage
// convention. Files land under `demorobot/<flowCategoryId>` so they are
// organized per FlowCategory, matching Asset.flowCategoryId ownership.

export interface CreateAssetFromFileInput {
  flowCategoryId: string
  type: 'document' | 'image' | 'video' | 'link'
  file: { buffer: Buffer; originalname: string; mimetype: string }
  title: string
  summary?: string
  language?: string
}

export interface CreateAssetLinkInput {
  flowCategoryId: string
  url: string
  title: string
  summary?: string
  language?: string
}

export async function listAssets(workspaceId: string, flowCategoryId: string) {
  const category = await prisma.flowCategory.findFirst({ where: { id: flowCategoryId, workspaceId } })
  if (!category) return null
  return prisma.asset.findMany({ where: { flowCategoryId }, orderBy: { createdAt: 'asc' } })
}

export async function createAssetFromFile(workspaceId: string, input: CreateAssetFromFileInput) {
  const category = await prisma.flowCategory.findFirst({ where: { id: input.flowCategoryId, workspaceId } })
  if (!category) return null

  const { url } = await storageService.upload(input.file.buffer, {
    filename: input.file.originalname,
    folder: `demorobot/${input.flowCategoryId}`,
    contentType: input.file.mimetype,
  })

  return prisma.asset.create({
    data: {
      flowCategoryId: input.flowCategoryId,
      type: input.type,
      url,
      title: input.title,
      summary: input.summary,
      language: input.language,
    },
  })
}

export async function createAssetLink(workspaceId: string, input: CreateAssetLinkInput) {
  const category = await prisma.flowCategory.findFirst({ where: { id: input.flowCategoryId, workspaceId } })
  if (!category) return null

  return prisma.asset.create({
    data: {
      flowCategoryId: input.flowCategoryId,
      type: 'link',
      url: input.url,
      title: input.title,
      summary: input.summary,
      language: input.language,
    },
  })
}

export async function deleteAsset(workspaceId: string, flowCategoryId: string, assetId: string): Promise<boolean> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, flowCategoryId, flowCategory: { workspaceId } },
  })
  if (!asset) return false
  await prisma.asset.delete({ where: { id: assetId } })
  return true
}
