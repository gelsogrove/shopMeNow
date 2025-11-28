import { API_URL } from "@/config"
import axios from "axios"
import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"

/**
 * ShortUrlRedirect Component
 * Handles /s/:code routes by resolving the short URL from backend
 * and redirecting to the original URL
 */
export default function ShortUrlRedirect() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    const resolveShortUrl = async () => {
      if (!code) {
        navigate("/not-found")
        return
      }

      try {
        // Call backend to resolve short URL
        // Remove /api from API_URL since /s/ is a root route
        const baseUrl = API_URL.replace("/api", "")
        const response = await axios.get(`${baseUrl}/s/${code}`, {
          maxRedirects: 0, // Don't follow redirects automatically
          validateStatus: (status) => status === 302 || status === 301, // Accept redirect status
        })

        // Backend returns 302 with Location header
        const originalUrl = response.headers.location

        if (originalUrl) {
          // Extract the path from the full URL
          const url = new URL(originalUrl)
          const targetPath = url.pathname + url.search + url.hash

          // Navigate to the target path
          window.location.href = targetPath
        } else {
          navigate("/not-found")
        }
      } catch (error: any) {
        console.error("Error resolving short URL:", error)

        // Check if it's a 404 or expired link
        if (error.response?.status === 404) {
          navigate("/not-found")
        } else if (error.response?.status === 410) {
          // 410 Gone - expired link
          navigate("/expired")
        } else {
          navigate("/not-found")
        }
      }
    }

    resolveShortUrl()
  }, [code, navigate])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Reindirizzamento in corso...</p>
      </div>
    </div>
  )
}
