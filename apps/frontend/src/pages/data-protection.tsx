import { logger } from "@/lib/logger"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { tokenApi } from "../services/tokenApi"

const DataProtectionPage = () => {
  const [searchParams] = useSearchParams()
  const lang = searchParams.get("lang") || "en"
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true)
        const response = await tokenApi.get(
          `/registration/data-protection?lang=${lang}`
        )
        setContent(response.data)
        setError(null)
      } catch (err) {
        logger.error("Error fetching data protection content:", err)
        setError("Failed to load content. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [lang])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white shadow-md rounded-lg max-w-lg w-full">
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-6 py-1">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-4 bg-gray-300 rounded col-span-2"></div>
                  <div className="h-4 bg-gray-300 rounded col-span-1"></div>
                </div>
                <div className="h-4 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white shadow-md rounded-lg max-w-lg w-full text-center">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-8 text-white">
          <h1 className="text-xl font-bold">
            {content?.title || "Data Protection"}
          </h1>
        </div>

        {/* Main content */}
        <div className="p-6">
          <div className="prose max-w-none">
            <p className="text-lg mb-6">{content?.content}</p>

            {/* Security visualization */}
            <div className="my-10 bg-gray-100 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">
                How Our Tokenization Works
              </h3>
              <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                <div className="flex-1 p-4 border rounded-lg bg-white text-center">
                  <div className="font-mono p-2 bg-gray-100 rounded">
                    {"Message: 'Hello, I'm John Smith.'"}
                  </div>
                </div>
                <div className="text-3xl">→</div>
                <div className="flex-1 p-4 border rounded-lg bg-white text-center">
                  <div className="font-mono p-2 bg-gray-100 rounded">
                    {"Message: 'Hello, I'm TOKEN_123.'"}
                  </div>
                </div>
                <div className="text-3xl">→</div>
                <div className="flex-1 p-4 border rounded-lg bg-white text-center">
                  <div className="font-mono p-2 bg-gray-100 rounded">
                    {"AI processes with anonymized data"}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional sections */}
            {content?.sections &&
              content.sections.map((section: any, index: number) => (
                <section key={index} className="my-8">
                  <h3 className="text-xl font-semibold mb-2">
                    {section.title}
                  </h3>
                  <p>{section.content}</p>
                </section>
              ))}

            {/* FAQ Section */}
            <section className="mt-12">
              <h2 className="text-lg font-bold mb-6">
                Frequently Asked Questions
              </h2>

              <div className="space-y-6">
                <details className="group border-l-4 border-blue-500 bg-gray-50 p-4">
                  <summary className="flex cursor-pointer items-center justify-between font-medium">
                    <span>What is data tokenization?</span>
                    <span className="transition group-open:rotate-180">
                      <svg
                        fill="none"
                        height="24"
                        width="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-4 text-gray-700">
                    Data tokenization is a security technique that replaces
                    sensitive data with non-sensitive substitutes, called
                    tokens. These tokens have no meaningful value if breached
                    and can't be mathematically reversed to reveal the original
                    data.
                  </p>
                </details>

                <details className="group border-l-4 border-blue-500 bg-gray-50 p-4">
                  <summary className="flex cursor-pointer items-center justify-between font-medium">
                    <span>
                      Is my personal information shared with AI models?
                    </span>
                    <span className="transition group-open:rotate-180">
                      <svg
                        fill="none"
                        height="24"
                        width="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-4 text-gray-700">
                    No. Our tokenization system replaces your personal
                    information with anonymous tokens before sending any data to
                    AI models. This means that the AI never has access to your
                    actual personal data.
                  </p>
                </details>

                <details className="group border-l-4 border-blue-500 bg-gray-50 p-4">
                  <summary className="flex cursor-pointer items-center justify-between font-medium">
                    <span>How long is my data stored?</span>
                    <span className="transition group-open:rotate-180">
                      <svg
                        fill="none"
                        height="24"
                        width="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-4 text-gray-700">
                    We store your data only for as long as necessary to provide
                    our services and comply with legal obligations. You can
                    request deletion of your data at any time through the
                    preferences management page.
                  </p>
                </details>

                <details className="group border-l-4 border-blue-500 bg-gray-50 p-4">
                  <summary className="flex cursor-pointer items-center justify-between font-medium">
                    <span>How do I manage or delete my data?</span>
                    <span className="transition group-open:rotate-180">
                      <svg
                        fill="none"
                        height="24"
                        width="24"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-4 text-gray-700">
                    You can request a preferences management link by sending
                    "update my preferences" via WhatsApp. This will give you
                    access to a secure page where you can view, update, or
                    request deletion of your data.
                  </p>
                </details>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} ShopMe. All rights reserved.</p>
          <p className="mt-1">
            For more information about our privacy practices, please contact our
            data protection officer.
          </p>
        </div>
      </div>
    </div>
  )
}

export default DataProtectionPage
