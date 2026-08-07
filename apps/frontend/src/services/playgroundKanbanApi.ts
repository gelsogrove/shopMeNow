/**
 * Playground Kanban API client.
 *
 * One board per Flow workspace, reachable from the public /demo/<slug>/kanban
 * page. Every call carries the playground `sessionId`: the backend resolves both
 * the workspace and the card author from it, so nothing here sends a workspace
 * id or an author name — see resolveKanbanIdentity in playground.controller.ts.
 */

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

export interface KanbanComment {
  id: string
  todoId: string
  commentText: string
  createdBy: string
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
