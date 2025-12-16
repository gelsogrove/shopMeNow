export interface AgentOptionItem {
  number: number
  label: string
  count?: number
  skus?: string[]
  id?: string
  metadata?: Record<string, any>
}

export interface AgentOptionMapping {
  type: "numbered" | "binary"
  listType?: string
  options?: AgentOptionItem[]
  currentOrderCode?: string
}
