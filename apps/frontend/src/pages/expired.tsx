import { useNavigate } from "react-router-dom"

const ExpiredPage = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-10 text-center">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-3xl font-bold text-white">Page Expired</h1>
          <p className="text-xl text-white text-opacity-80 mt-2">
            Link has expired
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <p className="text-gray-700 text-center mb-6">
            This link has expired and is no longer valid. Please request a new
            link or contact support if you need assistance.
          </p>

          <div className="mt-8 space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go Back
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full px-4 py-2 border border-transparent text-white bg-orange-500 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExpiredPage
