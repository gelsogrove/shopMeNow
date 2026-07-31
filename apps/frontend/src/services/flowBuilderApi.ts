import { api } from "./api"

// Types mirror the Prisma models in packages/database/prisma/schema.prisma
// (FlowCategory, Flow, FlowNode, FlowEdge, Asset) — see
// openspec/changes/demorobot-flow-chatbot/specs/flow-graph-editor/spec.md.

export interface FlowCategory {
  id: string
  workspaceId: string
  name: string
  slug: string
  description?: string | null
  lookupRules: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Flow {
  id: string
  workspaceId: string
  flowCategoryId?: string | null
  title: string
  description?: string | null
  keywords: string[]
  compiledPrompt: string
  hash: string
  createdAt: string
  updatedAt: string
}

export type TerminalType = "SELF_SERVICE" | "ESCALATE" | "END" | "LOOP" | null

export interface FlowNodeAttachmentRef {
  assetId: string
  asset?: Asset
}

export interface FlowNode {
  id: string
  flowId: string
  question: string
  positionX: number
  positionY: number
  fieldKey?: string | null
  fieldType?: "string" | "number" | "boolean" | "date" | "enum" | null
  terminalType: TerminalType
  attachments: FlowNodeAttachmentRef[]
}

export interface FlowEdge {
  id: string
  sourceNodeId: string
  targetNodeId?: string | null
  label: string
  triggersEscalation: boolean
}

export interface FlowGraph {
  flow: Flow
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface Asset {
  id: string
  flowCategoryId: string
  type: "document" | "image" | "video" | "link"
  url: string
  title: string
  summary?: string | null
  language?: string | null
}

export interface ValidationError {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export interface SaveFlowGraphResult {
  ok: boolean
  flow?: Flow
  validationReport?: ValidationError[]
  warnings?: Array<{ code: string; message: string; nodeId?: string }>
}

// NOTE: the `/demorobot/robot-models` URL segments are the stable wire format
// (kept deliberately, same precedent as the demorobot -> flow-builder rename).
// Only the TypeScript identifiers reflect the FlowCategory concept.
export const flowCategoryApi = {
  list: async (workspaceId: string): Promise<FlowCategory[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/demorobot/robot-models`)
    return response.data?.flowCategories ?? []
  },
  create: async (workspaceId: string, data: { name: string; slug: string; description?: string; lookupRules?: Record<string, unknown> }): Promise<FlowCategory> => {
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/robot-models`, data)
    return response.data
  },
  update: async (workspaceId: string, flowCategoryId: string, data: Partial<FlowCategory>): Promise<FlowCategory> => {
    const response = await api.patch(`/workspaces/${workspaceId}/demorobot/robot-models/${flowCategoryId}`, data)
    return response.data
  },
  delete: async (workspaceId: string, flowCategoryId: string): Promise<void> => {
    await api.delete(`/workspaces/${workspaceId}/demorobot/robot-models/${flowCategoryId}`)
  },
}

export const flowApi = {
  list: async (workspaceId: string, flowCategoryId: string | null): Promise<Flow[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/demorobot/flows`, {
      params: { robotModelId: flowCategoryId ?? undefined, generic: flowCategoryId === null ? "true" : undefined },
    })
    return response.data?.flows ?? []
  },
  create: async (workspaceId: string, data: { title: string; robotModelId: string | null; description?: string }): Promise<Flow> => {
    // `robotModelId` here is the request-body wire key expected by the backend.
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/flows`, data)
    return response.data
  },
  delete: async (workspaceId: string, flowId: string): Promise<void> => {
    await api.delete(`/workspaces/${workspaceId}/demorobot/flows/${flowId}`)
  },
  duplicate: async (workspaceId: string, flowId: string): Promise<Flow> => {
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/flows/${flowId}/duplicate`)
    return response.data?.flow
  },
  getGraph: async (workspaceId: string, flowId: string): Promise<FlowGraph> => {
    const response = await api.get(`/workspaces/${workspaceId}/demorobot/flows/${flowId}/graph`)
    return response.data
  },
  saveGraph: async (
    workspaceId: string,
    flowId: string,
    data: { nodes: Array<Omit<FlowNode, "attachments"> & { attachmentAssetIds?: string[] }>; edges: FlowEdge[]; title: string; description?: string; keywords?: string[] },
  ): Promise<SaveFlowGraphResult> => {
    const response = await api.put(`/workspaces/${workspaceId}/demorobot/flows/${flowId}/graph`, data)
    return response.data
  },
}

export const assetApi = {
  list: async (workspaceId: string, flowCategoryId: string): Promise<Asset[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/demorobot/robot-models/${flowCategoryId}/assets`)
    return response.data?.assets ?? []
  },
  uploadFile: async (
    workspaceId: string,
    flowCategoryId: string,
    // Videos are deliberately not offered: attachments are reference material
    // (manuals, spec sheets, photos), not media playback.
    data: { type: "document" | "image"; file: File; title: string; summary?: string; language?: string },
  ): Promise<Asset> => {
    const form = new FormData()
    form.append("file", data.file)
    form.append("type", data.type)
    form.append("title", data.title)
    if (data.summary) form.append("summary", data.summary)
    if (data.language) form.append("language", data.language)
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/robot-models/${flowCategoryId}/assets`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return response.data
  },
  createLink: async (workspaceId: string, flowCategoryId: string, data: { url: string; title: string; summary?: string; language?: string }): Promise<Asset> => {
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/robot-models/${flowCategoryId}/assets/link`, data)
    return response.data
  },
  delete: async (workspaceId: string, flowCategoryId: string, assetId: string): Promise<void> => {
    await api.delete(`/workspaces/${workspaceId}/demorobot/robot-models/${flowCategoryId}/assets/${assetId}`)
  },
}
