import { Link } from "react-router-dom"

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-gray-900">ShopMeNow</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 h-96 flex flex-col items-center justify-center">
              <h2 className="text-lg font-semibold mb-4">
                Welcome to ShopMeNow
              </h2>
              <p className="text-gray-600 text-center max-w-md mb-8">
                This is a WhatsApp-based e-commerce platform. Please use the
                link sent to your WhatsApp to register or access your account.
              </p>
              <div className="mt-4 flex space-x-4">
                <Link
                  to="/register"
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Register (Demo)
                </Link>
                <Link
                  to="/data-protection"
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Data Protection
                </Link>
                <Link
                  to="/auth/forgot-password"
                  className="px-4 py-2 border border-yellow-400 text-sm font-medium rounded-md shadow-sm text-yellow-900 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  Forgot Password
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default HomePage
