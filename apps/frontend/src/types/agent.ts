export interface Agent {
  id: string
  name: string
  content: string
  isRouter: boolean
  department: string | undefined
  createdAt: string
  updatedAt: string
  workspaceId: string
  temperature?: number
  top_p?: number
  top_k?: number
  model?: string
}

export interface CreateAgentData {
  name: string
  content: string
  isRouter?: boolean
  department?: string
  temperature?: number
  top_p?: number
  top_k?: number
  model?: string
}

export interface UpdateAgentData {
  name?: string
  content?: string
  isRouter?: boolean
  department?: string
  temperature?: number
  top_p?: number
  top_k?: number
  model?: string
} 