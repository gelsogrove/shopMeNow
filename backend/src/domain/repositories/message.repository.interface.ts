import { Message, MessageProps } from "../entities/message.entity"

export interface MessageRepositoryInterface {
  /**
   * Find all messages for a chat
   */
  findByChatId?(chatId: string): Promise<Message[]>

  /**
   * Find a message by ID
   */
  findById?(id: string): Promise<Message | null>

  /**
   * Create a new message
   */
  create?(message: Message): Promise<Message>

  /**
   * Update an existing message
   */
  update?(id: string, data: Partial<MessageProps>): Promise<Message | null>

  /**
   * Delete a message
   */
  delete?(id: string): Promise<boolean>

  /**
   * Delete all messages for a chat
   */
  deleteByChatId?(chatId: string): Promise<boolean>

  /**
   * Get latest messages for a phone number
   */
  getLatesttMessages?(
    phoneNumber: string,
    limit?: number,
    workspaceId?: string
  ): Promise<any[]>

  /**
   * Get recent chat sessions
   */
  getRecentChats?(limit?: number, workspaceId?: string): Promise<any[]>

  /**
   * Get chat sessions with unread counts
   */
  getChatSessionsWithUnreadCounts?(
    limit?: number,
    workspaceId?: string
  ): Promise<any[]>

  /**
   * Delete a chat session
   */
  deleteChat?(chatSessionId: string, workspaceId?: string): Promise<boolean>

  /**
   * Get the router agent for a workspace
   */
  getRouterAgent?(workspaceId?: string): Promise<any>

  /**
   * Get all products for a workspace
   */
  getProducts?(workspaceId?: string): Promise<any[]>

  /**
   * Get all services for a workspace
   */
  getServices?(workspaceId?: string): Promise<any[]>

  /**
   * Get all events for a workspace
   */
  getEvents?(workspaceId?: string): Promise<any[]>

  /**
   * Get agent by workspace ID
   */
  getAgentByWorkspaceId?(workspaceId: string): Promise<any>

  /**
   * Get response from an agent
   */
  getResponseFromAgent?(agent: any, message: string): Promise<any>

  /**
   * Get conversation response from LLM
   */
  getConversationResponse?(
    chatHistory: any[],
    message: string,
    systemPrompt: string
  ): Promise<string>
}
