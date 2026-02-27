/**
 * operatorDashboardApi
 *
 * API client for the operator selection dashboard.
 * No auth headers needed — the token is passed as query param or body.
 */

const API_BASE = "/api/v1/operator-dashboard"

export interface QueueEntry {
  customerId: string
  name: string
  phone: string | null
  channel: string | null
  position: number
  waitMinutes: number
  aiSummary: string
}

export interface AssignResult {
  token: string
  chatUrl: string
}

export const operatorDashboardApi = {
  async getQueue(token: string): Promise<QueueEntry[]> {
    const res = await fetch(
      `${API_BASE}/queue?token=${encodeURIComponent(token)}`
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json() as Promise<QueueEntry[]>
  },

  async assignCustomer(
    token: string,
    customerId: string
  ): Promise<AssignResult> {
    const res = await fetch(`${API_BASE}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, customerId }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json() as Promise<AssignResult>
  },
}
