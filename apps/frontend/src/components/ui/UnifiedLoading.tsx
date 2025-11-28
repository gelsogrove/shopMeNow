import React from 'react'

interface UnifiedLoadingProps {
  title?: string
  message?: string
  className?: string
}

export const UnifiedLoading: React.FC<UnifiedLoadingProps> = ({
  title = "Caricamento...",
  message = "Stiamo preparando i tuoi dati",
  className = ""
}) => {
  return (
    <div className={`min-h-screen bg-gray-100 flex items-center justify-center p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {/* Spinner animato */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        
        {/* Titolo */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h2>
        
        {/* Messaggio */}
        <p className="text-gray-600 mb-4">
          {message}
        </p>
        
        {/* Progress bar animata */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
        
        {/* Messaggio di attesa */}
        <p className="text-sm text-gray-500 mt-4">
          Attendere prego...
        </p>
      </div>
    </div>
  )
}

export default UnifiedLoading
