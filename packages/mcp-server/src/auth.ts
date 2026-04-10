import axios from "axios"

const HEROKU_BASE_URL = "https://www.echatbot.ai/api/v1"

export function getAuthToken(): string {
  const token = process.env.ECHATBOT_TOKEN
  if (!token) {
    throw new Error(
      "Missing ECHATBOT_TOKEN environment variable. Ask Andrea for a fresh token."
    )
  }
  return token
}

export function makeApiClient(token: string) {
  return axios.create({
    baseURL: HEROKU_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })
}
