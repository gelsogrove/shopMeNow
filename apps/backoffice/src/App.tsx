import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/Layout'
import { AccessDeniedPage } from '@/pages/AccessDeniedPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { PlatformsPage } from '@/pages/PlatformsPage'
import { PricingPage } from '@/pages/PricingPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { SchedulersPage } from '@/pages/SchedulersPage'
import { TrashPage } from '@/pages/TrashPage'
import { ComingSoonPage } from '@/pages/ComingSoonPage'

// 🌐 Base path for production deployment
// Standalone SPA - no basename needed (served from root)
const basename = ''

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    // Redirect to access denied page (no login form - must come from Frontend)
    return <Navigate to="/access-denied" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Access Denied - shown when not authenticated */}
      <Route 
        path="/access-denied" 
        element={isAuthenticated ? <Navigate to="/platforms" replace /> : <AccessDeniedPage />} 
      />
      {/* Auth Callback - receives token from Frontend redirect */}
      <Route 
        path="/auth/callback" 
        element={<AuthCallbackPage />} 
      />
      {/* Protected Routes */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/platforms" replace />} />
        <Route path="platforms" element={<PlatformsPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route 
          path="gdpr" 
          element={
            <ComingSoonPage 
              title="GDPR" 
              description="GDPR compliance tools coming soon. Manage data retention, consent, and privacy settings."
            />
          } 
        />
        <Route 
          path="schedulers" 
          element={<SchedulersPage />} 
        />
        <Route 
          path="trash" 
          element={<TrashPage />} 
        />
      </Route>
      {/* Catch all - redirect to access denied if not authenticated */}
      <Route path="*" element={<Navigate to="/access-denied" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
