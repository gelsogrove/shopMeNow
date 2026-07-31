import { api } from "./api"

// Types mirror the Prisma models in packages/database/prisma/schema.prisma
// (RobotModel, Flow, FlowNode, FlowEdge, Asset) — see
// openspec/changes/demorobot-flow-chatbot/specs/flow-graph-editor/spec.md.

export interface RobotModel {
  id: string
  workspaceId: string
  name: string
  slug: string
  manufacturer?: string | null
  description?: string | null
  lookupRules: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface Flow {
  id: string
  workspaceId: string
  robotModelId?: string | null
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
  robotModelId: string
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

export const robotModelApi = {
  list: async (workspaceId: string): Promise<RobotModel[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/demorobot/robot-models`)
    return response.data?.robotModels ?? []
  },
  create: async (workspaceId: string, data: { name: string; slug: string; manufacturer?: string; description?: string; lookupRules?: Record<string, unknown> }): Promise<RobotModel> => {
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/robot-models`, data)
    return response.data
  },
  update: async (workspaceId: string, robotModelId: string, data: Partial<RobotModel>): Promise<RobotModel> => {
    const response = await api.patch(`/workspaces/${workspaceId}/demorobot/robot-models/${robotModelId}`, data)
    return response.data
  },
  delete: async (workspaceId: string, robotModelId: string): Promise<void> => {
    await api.delete(`/workspaces/${workspaceId}/demorobot/robot-models/${robotModelId}`)
  },
}

export const flowApi = {
  list: async (workspaceId: string, robotModelId: string | null): Promise<Flow[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/demorobot/flows`, {
      params: { robotModelId: robotModelId ?? undefined, generic: robotModelId === null ? "true" : undefined },
    })
    return response.data?.flows ?? []
  },
  create: async (workspaceId: string, data: { title: string; robotModelId: string | null; description?: string }): Promise<Flow> => {
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/flows`, data)
    return response.data
  },
  delete: async (workspaceId: string, flowId: string): Promise<void> => {
    await api.delete(`/workspaces/${workspaceId}/demorobot/flows/${flowId}`)
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
  list: async (workspaceId: string, robotModelId: string): Promise<Asset[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/demorobot/robot-models/${robotModelId}/assets`)
    return response.data?.assets ?? []
  },
  uploadFile: async (
    workspaceId: string,
    robotModelId: string,
    data: { type: "document" | "image" | "video"; file: File; title: string; summary?: string; language?: string },
  ): Promise<Asset> => {
    const form = new FormData()
    form.append("file", data.file)
    form.append("type", data.type)
    form.append("title", data.title)
    if (data.summary) form.append("summary", data.summary)
    if (data.language) form.append("language", data.language)
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/robot-models/${robotModelId}/assets`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return response.data
  },
  createLink: async (workspaceId: string, robotModelId: string, data: { url: string; title: string; summary?: string; language?: string }): Promise<Asset> => {
    const response = await api.post(`/workspaces/${workspaceId}/demorobot/robot-models/${robotModelId}/assets/link`, data)
    return response.data
  },
  delete: async (workspaceId: string, robotModelId: string, assetId: string): Promise<void> => {
    await api.delete(`/workspaces/${workspaceId}/demorobot/robot-models/${robotModelId}/assets/${assetId}`)
  },
}
