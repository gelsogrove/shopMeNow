import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-10 text-center">
          <h1 className="text-6xl font-bold text-white">404</h1>
          <p className="text-xl text-white text-opacity-80 mt-2">Page Not Found</p>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <p className="text-gray-700 text-center mb-6">
            Sorry, the page you are looking for doesn't exist or has been moved.
          </p>

          <div className="mt-8">
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2 border border-transparent text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage; 