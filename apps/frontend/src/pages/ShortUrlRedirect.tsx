import { API_URL } from "@/config"
import { useEffect, useRef } from "react"
import { useParams } from "react-router-dom"

/**
 * ShortUrlRedirect Component
 * Handles /s/:code routes by calling backend API to resolve the URL
 * Then redirects to the resolved URL
 * 
 * WHY NOT DIRECT BACKEND REDIRECT?
 * Because React Router intercepts /s/:code before it reaches the backend.
 * So we call the backend's /s/:code/resolve endpoint to get the final URL,
 * then do a client-side redirect.
 */
export default function ShortUrlRedirect() {
  const { code } = useParams<{ code: string }>()
  const hasRedirected = useRef(false)

  useEffect(() => {
    // Prevent double execution
    if (hasRedirected.current) return
    hasRedirected.current = true

    if (!code) {
      window.location.href = "/not-found"
      return
    }

    // Call backend to resolve the short URL
    const backendUrl = API_URL.replace("/api", "")
    const resolveUrl = `${backendUrl}/s/${code}/resolve`

    fetch(resolveUrl)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.originalUrl) {
          window.location.replace(data.originalUrl)
        } else if (data.expired) {
          window.location.replace("/expired")
        } else if (data.notFound) {
          window.location.replace("/not-found")
        } else {
          window.location.replace("/not-found")
        }
      })
      .catch(() => {
        window.location.replace("/not-found")
      })
  }, [code])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
