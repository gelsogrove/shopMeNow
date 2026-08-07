/**
 * Playground Kanban API client — one board per workspace, two ways in.
 *
 * `kanbanApi` (bottom of this file) is the IN-APP client: it goes through the
 * shared axios instance, which already attaches the JWT and x-workspace-id, so
 * the backend identifies the author as STAFF from the token.
 *
 * The bare functions above it are the PUBLIC-DEMO client: no token exists
 * there, so each call carries the playground `sessionId` and the backend
 * resolves the workspace and the author name from it (authorKind CUSTOMER).
 *
 * Neither client ever sends a workspace id or an author name in the payload —
 * see resolveKanbanIdentity in playground.controller.ts.
 */
import { api } from "@/services/api"

export const KANBAN_COLUMNS = [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
  "NICE_TO_HAVE",
] as const

export type KanbanStatus = (typeof KANBAN_COLUMNS)[number]

export const KANBAN_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const

export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number]

/** Where an author came from. Names collide across the two doors. */
export type KanbanAuthorKind = "STAFF" | "CUSTOMER"

export interface KanbanComment {
  id: string
  todoId: string
  commentText: string
  createdBy: string
  authorKind: KanbanAuthorKind
  color: string | null
  createdAt: string
}

export interface KanbanTodo {
  id: string
  workspaceId: string
  dialogId: string
  messageType: "chatbot" | "human"
  messageContent: string
  chatbotResponse: string | null
  commentTitle: string
  priority: KanbanPriority
  status: KanbanStatus
  position: number
  createdBy: string
  authorKind: KanbanAuthorKind
  createdAt: string
  updatedAt: string
  comments: KanbanComment[]
}

export interface CreateTodoInput {
  dialogId: string
  messageType: "chatbot" | "human"
  messageContent: string
  chatbotResponse?: string | null
  commentTitle: string
  priority?: KanbanPriority
  firstComment?: string
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return body?.error || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export function fetchTodos(
  apiUrl: string,
  sessionId: string
): Promise<{ todos: KanbanTodo[] }> {
  const query = new URLSearchParams({ sessionId })
  return request(`${apiUrl}/playground/todos?${query}`)
}

export function createTodo(
  apiUrl: string,
  sessionId: string,
  input: CreateTodoInput
): Promise<KanbanTodo> {
  return request(`${apiUrl}/playground/todos`, {
    method: "POST",
    body: JSON.stringify({ sessionId, ...input }),
  })
}

export function updateTodo(
  apiUrl: string,
  sessionId: string,
  id: string,
  patch: Partial<Pick<KanbanTodo, "status" | "priority" | "position" | "commentTitle">>
): Promise<KanbanTodo> {
  return request(`${apiUrl}/playground/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ sessionId, ...patch }),
  })
}

export function deleteTodo(
  apiUrl: string,
  sessionId: string,
  id: string
): Promise<{ success: boolean }> {
  const query = new URLSearchParams({ sessionId })
  return request(`${apiUrl}/playground/todos/${id}?${query}`, { method: "DELETE" })
}

export function addComment(
  apiUrl: string,
  sessionId: string,
  todoId: string,
  commentText: string
): Promise<KanbanComment> {
  return request(`${apiUrl}/playground/todos/${todoId}/comments`, {
    method: "POST",
    body: JSON.stringify({ sessionId, commentText }),
  })
}

export function deleteComment(
  apiUrl: string,
  sessionId: string,
  todoId: string,
  commentId: string
): Promise<void> {
  const query = new URLSearchParams({ sessionId })
  return request(
    `${apiUrl}/playground/todos/${todoId}/comments/${commentId}?${query}`,
    { method: "DELETE" }
  )
}

/**
 * In-app client. The shared axios instance attaches the JWT and the workspace
 * header, so no sessionId is needed — the backend reads the author from the
 * token and files the card as STAFF.
 */
export const kanbanApi = {
  async list(): Promise<KanbanTodo[]> {
    const { data } = await api.get("/playground/todos")
    return data.todos
  },

  async create(input: CreateTodoInput): Promise<KanbanTodo> {
    const { data } = await api.post("/playground/todos", input)
    return data
  },

  async update(
    id: string,
    patch: Partial<Pick<KanbanTodo, "status" | "priority" | "position" | "commentTitle">>
  ): Promise<KanbanTodo> {
    const { data } = await api.patch(`/playground/todos/${id}`, patch)
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/playground/todos/${id}`)
  },

  async comment(todoId: string, commentText: string): Promise<KanbanComment> {
    const { data } = await api.post(`/playground/todos/${todoId}/comments`, {
      commentText,
    })
    return data
  },

  async removeComment(todoId: string, commentId: string): Promise<void> {
    await api.delete(`/playground/todos/${todoId}/comments/${commentId}`)
  },
}
