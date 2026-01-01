import { logger } from "@/lib/logger"

const STORAGE_KEYS = {
  token: "token",
  user: "user",
  currentWorkspace: "currentWorkspace",
  sessionId: "sessionId",
  selectedChatId: "selectedChatId",
  currentChatSessionId: "currentChatSessionId",
  selectedChat: "selectedChat",
  chatMessages: "chatMessages",
  chatListUpdated: "chat-list-updated",
  workspaceChanged: "workspace-changed",
  isImpersonating: "isImpersonating",
  impersonatorEmail: "impersonatorEmail",
}

const safeParse = <T>(value: string | null, label: string): T | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch (error) {
    logger.error(`Error parsing ${label} from storage:`, error)
    return null
  }
}

export const storage = {
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.token)
  },
  setToken(token: string) {
    localStorage.setItem(STORAGE_KEYS.token, token)
  },
  clearToken() {
    localStorage.removeItem(STORAGE_KEYS.token)
  },
  getUser<T = any>(): T | null {
    return safeParse<T>(localStorage.getItem(STORAGE_KEYS.user), "user")
  },
  setUser(user: unknown) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
  },
  clearUser() {
    localStorage.removeItem(STORAGE_KEYS.user)
  },
  getWorkspace<T = any>(): T | null {
    return safeParse<T>(
      localStorage.getItem(STORAGE_KEYS.currentWorkspace),
      "workspace"
    )
  },
  setWorkspace(workspace: unknown) {
    localStorage.setItem(
      STORAGE_KEYS.currentWorkspace,
      JSON.stringify(workspace)
    )
  },
  clearWorkspace() {
    localStorage.removeItem(STORAGE_KEYS.currentWorkspace)
    sessionStorage.removeItem(STORAGE_KEYS.currentWorkspace)
  },
  getSessionId(): string | null {
    return sessionStorage.getItem(STORAGE_KEYS.sessionId)
  },
  setSessionId(sessionId: string) {
    sessionStorage.setItem(STORAGE_KEYS.sessionId, sessionId)
  },
  clearSessionId() {
    sessionStorage.removeItem(STORAGE_KEYS.sessionId)
    localStorage.removeItem(STORAGE_KEYS.sessionId)
  },
  getSelectedChatId(): string | null {
    return sessionStorage.getItem(STORAGE_KEYS.selectedChatId)
  },
  setSelectedChatId(chatId: string) {
    sessionStorage.setItem(STORAGE_KEYS.selectedChatId, chatId)
  },
  clearSelectedChatId() {
    sessionStorage.removeItem(STORAGE_KEYS.selectedChatId)
  },
  getSelectedChat<T = any>(): T | null {
    return safeParse<T>(localStorage.getItem(STORAGE_KEYS.selectedChat), "selectedChat")
  },
  setSelectedChat(chat: unknown) {
    localStorage.setItem(STORAGE_KEYS.selectedChat, JSON.stringify(chat))
  },
  clearSelectedChat() {
    localStorage.removeItem(STORAGE_KEYS.selectedChat)
  },
  setCurrentChatSessionId(sessionId: string) {
    sessionStorage.setItem(STORAGE_KEYS.currentChatSessionId, sessionId)
  },
  getCurrentChatSessionId(): string | null {
    return sessionStorage.getItem(STORAGE_KEYS.currentChatSessionId)
  },
  clearCurrentChatSessionId() {
    sessionStorage.removeItem(STORAGE_KEYS.currentChatSessionId)
  },
  setChatListUpdated(timestamp = Date.now()) {
    localStorage.setItem(STORAGE_KEYS.chatListUpdated, String(timestamp))
  },
  clearChatListUpdated() {
    localStorage.removeItem(STORAGE_KEYS.chatListUpdated)
  },
  setWorkspaceChanged(timestamp = Date.now()) {
    localStorage.setItem(STORAGE_KEYS.workspaceChanged, String(timestamp))
  },
  clearWorkspaceChanged() {
    localStorage.removeItem(STORAGE_KEYS.workspaceChanged)
  },
  clearChatCache() {
    localStorage.removeItem(STORAGE_KEYS.selectedChat)
    localStorage.removeItem(STORAGE_KEYS.chatMessages)
    localStorage.removeItem(STORAGE_KEYS.chatListUpdated)
    localStorage.removeItem(STORAGE_KEYS.workspaceChanged)
    sessionStorage.removeItem(STORAGE_KEYS.selectedChatId)
    sessionStorage.removeItem(STORAGE_KEYS.currentChatSessionId)
  },
  getImpersonationFlags(): { isImpersonating: boolean; impersonatorEmail: string | null } {
    return {
      isImpersonating: localStorage.getItem(STORAGE_KEYS.isImpersonating) === "true",
      impersonatorEmail: localStorage.getItem(STORAGE_KEYS.impersonatorEmail),
    }
  },
  setImpersonationFlags(isImpersonating: boolean, impersonatorEmail?: string | null) {
    if (isImpersonating) {
      localStorage.setItem(STORAGE_KEYS.isImpersonating, "true")
      localStorage.setItem(STORAGE_KEYS.impersonatorEmail, impersonatorEmail || "")
    } else {
      localStorage.removeItem(STORAGE_KEYS.isImpersonating)
      localStorage.removeItem(STORAGE_KEYS.impersonatorEmail)
    }
  },
  clearImpersonationFlags() {
    localStorage.removeItem(STORAGE_KEYS.isImpersonating)
    localStorage.removeItem(STORAGE_KEYS.impersonatorEmail)
  },
  clearAuth() {
    localStorage.removeItem(STORAGE_KEYS.token)
    localStorage.removeItem(STORAGE_KEYS.user)
    localStorage.removeItem(STORAGE_KEYS.currentWorkspace)
    localStorage.removeItem(STORAGE_KEYS.sessionId)
    sessionStorage.removeItem(STORAGE_KEYS.currentWorkspace)
    sessionStorage.removeItem(STORAGE_KEYS.sessionId)
    sessionStorage.removeItem(STORAGE_KEYS.selectedChatId)
    sessionStorage.removeItem(STORAGE_KEYS.currentChatSessionId)
  },
  clearAppState() {
    this.clearAuth()
    this.clearChatCache()
    this.clearImpersonationFlags()
  },
  clearAll() {
    localStorage.clear()
    sessionStorage.clear()
  },
}
