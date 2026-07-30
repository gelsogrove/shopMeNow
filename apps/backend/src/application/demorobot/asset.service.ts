import { prisma } from '@echatbot/database'
import { storageService } from '../../services/storage.service'

// Asset upload: reuses the existing storageService (Cloudinary in
// production, local filesystem in dev) rather than inventing a new storage
// convention. Files land under `demorobot/<robotModelId>` so they are
// organized per RobotModel, matching Asset.robotModelId ownership.

export interface CreateAssetFromFileInput {
  robotModelId: string
  type: 'document' | 'image' | 'video' | 'link'
  file: { buffer: Buffer; originalname: string; mimetype: string }
  title: string
  summary?: string
  language?: string
}

export interface CreateAssetLinkInput {
  robotModelId: string
  url: string
  title: string
  summary?: string
  language?: string
}

export async function listAssets(workspaceId: string, robotModelId: string) {
  const model = await prisma.robotModel.findFirst({ where: { id: robotModelId, workspaceId } })
  if (!model) return null
  return prisma.asset.findMany({ where: { robotModelId }, orderBy: { createdAt: 'asc' } })
}

export async function createAssetFromFile(workspaceId: string, input: CreateAssetFromFileInput) {
  const model = await prisma.robotModel.findFirst({ where: { id: input.robotModelId, workspaceId } })
  if (!model) return null

  const { url } = await storageService.upload(input.file.buffer, {
    filename: input.file.originalname,
    folder: `demorobot/${input.robotModelId}`,
    contentType: input.file.mimetype,
  })

  return prisma.asset.create({
    data: {
      robotModelId: input.robotModelId,
      type: input.type,
      url,
      title: input.title,
      summary: input.summary,
      language: input.language,
    },
  })
}

export async function createAssetLink(workspaceId: string, input: CreateAssetLinkInput) {
  const model = await prisma.robotModel.findFirst({ where: { id: input.robotModelId, workspaceId } })
  if (!model) return null

  return prisma.asset.create({
    data: {
      robotModelId: input.robotModelId,
      type: 'link',
      url: input.url,
      title: input.title,
      summary: input.summary,
      language: input.language,
    },
  })
}

export async function deleteAsset(workspaceId: string, robotModelId: string, assetId: string): Promise<boolean> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, robotModelId, robotModel: { workspaceId } },
  })
  if (!asset) return false
  await prisma.asset.delete({ where: { id: assetId } })
  return true
}
