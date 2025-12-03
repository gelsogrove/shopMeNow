import { API_URL } from "@/config"
import axios from "axios"
import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

/**
 * ShortUrlRedirect Component
 * Handles /s/:code routes by resolving the short URL from backend
 * and redirecting to the original URL
 */
export default function ShortUrlRedirect() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const hasResolved = useRef(false) // Prevent double execution in StrictMode

  useEffect(() => {
    // Prevent double execution (React StrictMode calls useEffect twice)
    if (hasResolved.current) {
      console.log("[ShortUrlRedirect] Already resolved, skipping...")
      return
    }

    const resolveShortUrl = async () => {
      if (!code) {
        navigate("/not-found", { replace: true })
        return
      }

      // Mark as resolving to prevent double execution
      hasResolved.current = true

      try {
        // Call backend to resolve short URL using JSON endpoint
        // This avoids CORS issues with redirect headers
        const baseUrl = API_URL.replace("/api", "")
        console.log(`[ShortUrlRedirect] Resolving short URL: ${baseUrl}/s/${code}/resolve`)
        
        const response = await axios.get(`${baseUrl}/s/${code}/resolve`)

        if (response.data.success && response.data.originalUrl) {
          const originalUrl = response.data.originalUrl
          console.log(`[ShortUrlRedirect] Original URL: ${originalUrl}`)
          
          // Check if it's already a relative path or full URL
          let targetPath: string
          
          if (originalUrl.startsWith("/")) {
            // Already a relative path
            targetPath = originalUrl
          } else if (originalUrl.startsWith("http")) {
            // Full URL - extract path + query + hash
            try {
              const url = new URL(originalUrl)
              targetPath = url.pathname + url.search + url.hash
            } catch (e) {
              console.error("[ShortUrlRedirect] Invalid URL format:", originalUrl)
              targetPath = originalUrl
            }
          } else {
            // Unknown format, use as-is
            targetPath = "/" + originalUrl
          }

          console.log(`[ShortUrlRedirect] Navigating to: ${targetPath}`)
          
          // Small delay to ensure component is fully mounted before navigation
          setTimeout(() => {
            navigate(targetPath, { replace: true })
          }, 50)
        } else {
          console.error("[ShortUrlRedirect] No originalUrl in response:", response.data)
          navigate("/not-found", { replace: true })
        }
      } catch (error: any) {
        console.error("[ShortUrlRedirect] Error resolving short URL:", error)
        hasResolved.current = false // Allow retry on error

        // Check if it's a 404 or expired link
        if (error.response?.status === 404) {
          navigate("/not-found", { replace: true })
        } else if (error.response?.status === 410) {
          // 410 Gone - expired link
          navigate("/expired", { replace: true })
        } else {
          setError("Errore nel caricamento del link")
          // Retry after a short delay
          setTimeout(() => {
            navigate("/not-found", { replace: true })
          }, 2000)
        }
      }
    }

    // Small initial delay to ensure component is mounted
    const timer = setTimeout(resolveShortUrl, 100)
    
    return () => clearTimeout(timer)
  }, [code, navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <p className="text-gray-500 text-sm">Reindirizzamento in corso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Reindirizzamento in corso...</p>
      </div>
    </div>
  )
}
