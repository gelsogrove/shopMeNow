import QuestionnairePage from "@/pages/QuestionnairePage"
import GdprPage from "@/pages/GdprPage"
import { SettingsPage } from "@/pages/SettingsPage"
import WidgetPage from "@/pages/WidgetPage"
import WidgetSettingsPage from "@/pages/WidgetSettingsPage"
import WidgetEmbedPage from "@/pages/WidgetEmbedPage"
import WidgetTestPage from "@/pages/WidgetTestPage"
import { LegalDocumentPage } from "@/pages/LegalDocumentPage"
import { FeaturesPage } from "@/pages/FeaturesPage"
import { WidgetToWhatsAppPage } from "@/pages/WidgetToWhatsAppPage"
import { HumanSupportPage } from "@/pages/HumanSupportPage"
import { CrmIntegrationPage } from "@/pages/CrmIntegrationPage"
import { TeamCollaborationPage } from "@/pages/TeamCollaborationPage"
import { PrivacyByDesignPage } from "@/pages/PrivacyByDesignPage"
import { PricingPage } from "@/pages/PricingPage"
import { ContactPage } from "@/pages/ContactPage"
import { NeapolisPage } from "@/pages/NeapolisPage"
import OnboardingPage from "@/pages/OnboardingPage"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { Toaster } from "sonner"
import { MinimalLayout } from "./components/layout/MinimalLayout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { WidgetLoader } from "./components/WidgetLoader"
import { ChatProvider } from "./contexts/ChatContext"
import { AcceptInvitePage } from "./pages/AcceptInvitePage"
import { AgentConfigurationPage } from "./pages/AgentConfigurationPage"
import { AnalyticsPage } from "./pages/AnalyticsPage"
import Setup2FAPage from "./pages/auth/Setup2FAPage"
import Verify2FAPage from "./pages/auth/Verify2FAPage"
import TwoFactorResetPage from "./pages/auth/TwoFactorResetPage"
import ImpersonatePage from "./pages/auth/ImpersonatePage"
import { ChatPage } from "./pages/ChatPage"
import ClientsPage from "./pages/ClientsPage"
import { QueuePage } from "./pages/QueuePage"

import DataProtectionPage from "./pages/data-protection"

import CampaignsPage from "./pages/campaigns"
import CheckoutSuccessPage from "./pages/checkout-success"
import CheckoutPage from "./pages/CheckoutPage"
import ExpiredPage from "./pages/expired"
import { FAQPage } from "./pages/FAQPage"
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage"
import { LoginPage } from "./pages/LoginPage"
import NotFoundPage from "./pages/not-found"
import { OffersPage } from "./pages/OffersPage"
import OrdersPage from "./pages/OrdersPage"
import OrderSummaryPage from "./pages/OrderSummaryPage"
import { PrivacyPage } from "./pages/PrivacyPage"
import { TermsPage } from "./pages/TermsPage"
import { RefundPolicy } from "./pages/RefundPolicy"

import CategoriesPage from "./pages/products/CategoriesPage"
import { ProductsPage } from "./pages/ProductsPage"
import ProfilePage from "./pages/ProfilePage"
import BillingPage from "./pages/BillingPage"
import SupportTicketsPage from "./pages/SupportTicketsPage"
import RegistrationSuccess from "./pages/registration-success"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import SalesPage from "./pages/SalesPage"
import { ServicesPage } from "./pages/ServicesPage"
import { CategoriesPage as SettingsCategoriesPage } from "./pages/settings/CategoriesPage"
import { ChannelTypesPage } from "./pages/settings/ChannelTypesPage"
import { LanguagesPage } from "./pages/settings/LanguagesPage"

import { ProductsPage as SettingsProductsPage } from "./pages/settings/ProductsPage"

import { Suspense, lazy } from "react"
import { ChatWidget } from "@/components/ChatWidget"
import { useWorkspaceRole } from "./hooks/useWorkspaceRole"
import { useWorkspace } from "./hooks/use-workspace"
import { BillingProvider } from "./contexts/BillingContext"
import { ChatListProvider } from "./contexts/ChatListContext"
import { CustomerEditProvider } from "./contexts/CustomerEditContext"
import { WorkspaceProvider } from "./contexts/WorkspaceContext"
import { VerifyOtpPage } from "./pages/VerifyOtpPage"
import { WorkspacePage } from "./pages/WorkspacePage"
import { WorkspaceSelectionPage } from "./pages/WorkspaceSelectionPage"
import { PayPalResultPage } from "./pages/PayPalResultPage"

const CustomerProfilePublicPage = lazy(
  () => import("./pages/CustomerProfilePublicPage")
)
const OrdersPublicPage = lazy(() => import("./pages/OrdersPublicPage"))
const FeedbackPage = lazy(() => import("./pages/feedback"))
const RegisterPage = lazy(() => import("./pages/register"))
const SupportChatPage = lazy(() => import("./pages/SupportChatPage"))
const OperatorDashboardPage = lazy(() => import("./pages/OperatorDashboardPage"))

function AuthLoginRedirect() {
  const location = useLocation()
  return <Navigate to={`/${location.search}`} replace />
}

// Protected billing route - only owners can access
function ProtectedBillingRoute() {
  // ✅ Billing è a livello OWNER, non workspace
  // Le fatture sono per TUTTI i workspace dell'owner, non serve workspace selezionato
  return <BillingPage />
}

// Protected analytics route - only owners can access
function ProtectedAnalyticsRoute() {
  const { workspace } = useWorkspace()
  const { isSuperAdmin, isLoading } = useWorkspaceRole(workspace?.id)
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }
  
  if (!isSuperAdmin) {
    return <Navigate to="/workspace-selection" replace />
  }
  
  return <AnalyticsPage />
}

// Renders the platform support widget on all pages except /survey and /neapolis
function GlobalChatWidget() {
  const location = useLocation()
  // Hide eChatbot HQ support widget on /chat (has its own playground when debugMode=true)
  const EXCLUDED_PATHS = ["/survey", "/neapolis", "/onboarding", "/chat"]
  if (EXCLUDED_PATHS.includes(location.pathname)) return null
  return (
    <ChatWidget
      workspaceId="echatbot-hq-support"
      position="bottom-right"
    />
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" duration={800} />
      <Routes>
        {/* Operator Support Chat — token-based, NO PROVIDERS (public, standalone) */}
        <Route
          path="/support-chat"
          element={
            <Suspense
              fallback={
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              }
            >
              <SupportChatPage />
            </Suspense>
          }
        />

        {/* Operator Dashboard — token-based, NO PROVIDERS (public, standalone) */}
        <Route
          path="/operator-dashboard"
          element={
            <Suspense
              fallback={
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                  <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
                </div>
              }
            >
              <OperatorDashboardPage />
            </Suspense>
          }
        />
        
        {/* ALL OTHER ROUTES (with providers) */}
        <Route path="*" element={<AppWithProviders />} />
      </Routes>
    </BrowserRouter>
  )
}

function AppWithProviders() {
  return (
    <WorkspaceProvider>
      <BillingProvider>
        <CustomerEditProvider>
          <ChatProvider>
            <ChatListProvider>
              <Routes>
                {/* ROOT: Login is the homepage */}
                <Route path="/" element={<LoginPage />} />

                {/* Auth Routes - accessibili senza autenticazione */}
                <Route path="/auth">
                  {/* ✅ Preserve query params (e.g., ?admin=true) during redirect */}
                  <Route path="login" element={<AuthLoginRedirect />} />
                  <Route path="signup" element={<Navigate to="/?action=register" replace />} />
                  <Route path="register" element={<Navigate to="/?action=register" replace />} />
                  <Route path="setup-2fa" element={<Setup2FAPage />} />
                  <Route path="verify-2fa" element={<Verify2FAPage />} />
                  <Route path="2fa-reset/:token" element={<TwoFactorResetPage />} />
                  <Route
                    path="forgot-password"
                    element={<ForgotPasswordPage />}
                  />
                  <Route
                    path="reset-password"
                    element={<ResetPasswordPage />}
                  />
                  <Route path="verify-otp" element={<VerifyOtpPage />} />
                </Route>

                {/* Impersonate Route - OUTSIDE /auth to avoid LoginPage storage clearing */}
                <Route path="/impersonate" element={<ImpersonatePage />} />

                {/* Legacy landing route: redirect to login */}
                <Route path="/landing" element={<Navigate to="/" replace />} />
                
                {/* Widget Test Page - Public (for backoffice testing) */}
                <Route path="/widget-test" element={<WidgetTestPage />} />
                
                {/* Public Legal Pages - DYNAMIC (from database) */}
                <Route path="/privacy" element={<LegalDocumentPage docType="PRIVACY_POLICY" />} />
                <Route path="/terms" element={<LegalDocumentPage docType="TERMS_OF_SERVICE" />} />
                <Route path="/refund" element={<LegalDocumentPage docType="REFUND_POLICY" />} />
                <Route path="/gdpr" element={<LegalDocumentPage docType="GDPR" />} />
                {/* Legacy URLs - redirect to new paths */}
                <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
                <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
                <Route path="/refund-policy" element={<Navigate to="/refund" replace />} />
                <Route path="/gdpr-policy" element={<Navigate to="/gdpr" replace />} />

                {/* Public SEO Marketing Pages */}
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/widget-to-whatsapp" element={<WidgetToWhatsAppPage />} />
                <Route path="/human-support" element={<HumanSupportPage />} />
                <Route path="/crm-integration" element={<CrmIntegrationPage />} />
                <Route path="/team-collaboration" element={<TeamCollaborationPage />} />
                <Route path="/privacy-by-design" element={<PrivacyByDesignPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/neapolis" element={<NeapolisPage />} />
                {/* Direct route for /forgot-password to avoid 404 */}
                <Route
                  path="/forgot-password"
                  element={<ForgotPasswordPage />}
                />
                {/* Accept Invite - public route for team invitation acceptance */}
                <Route path="/accept-invite" element={<AcceptInvitePage />} />
                {/* Public widget iframe */}
                <Route path="/widget-embed" element={<WidgetEmbedPage />} />
                
                {/* PayPal callback result page - NO AUTH REQUIRED */}
                <Route path="/paypal-result" element={<PayPalResultPage />} />

                {/* Survey - Public, no auth */}
                <Route path="/survey" element={<QuestionnairePage />} />

                {/* Onboarding - Public, dedicated page with its own header */}
                <Route path="/onboarding" element={<OnboardingPage />} />

                {/* NOTE: Short URLs (/s/:code) are handled by Vite proxy directly to backend */}
                {/* No React route needed - see vite.config.ts proxy for "^/s/" */}

                {/* Protected Routes - richiedono autenticazione */}
                <Route element={<ProtectedRoute />}>
                  {/* Workspace Selection */}
                  <Route
                    path="/workspace-selection"
                    element={<WorkspaceSelectionPage />}
                  />

                  {/* Layout senza sidebar */}
                  <Route path="/chat" element={<MinimalLayout />}>
                    <Route index element={<ChatPage />} />
                  </Route>
                  <Route path="/queue" element={<MinimalLayout />}>
                    <Route index element={<QueuePage />} />
                  </Route>
                  <Route path="/analytics" element={<MinimalLayout />}>
                    <Route index element={<ProtectedAnalyticsRoute />} />
                  </Route>
                  <Route path="/agents" element={<MinimalLayout />}>
                    <Route index element={<AgentConfigurationPage />} />
                  </Route>
                  <Route path="/widget" element={<MinimalLayout />}>
                    <Route index element={<WidgetPage />} />
                  </Route>
                  <Route path="/widget-settings" element={<MinimalLayout />}>
                    <Route index element={<WidgetSettingsPage />} />
                  </Route>
                  <Route path="/clients" element={<MinimalLayout />}>
                    <Route index element={<ClientsPage />} />
                    <Route path=":id" element={<ClientsPage />} />
                  </Route>
                  <Route path="/sales" element={<MinimalLayout />}>
                    <Route index element={<SalesPage />} />
                  </Route>
                  <Route path="/admin/orders" element={<MinimalLayout />}>
                    <Route index element={<OrdersPage />} />
                  </Route>
                  <Route path="/products" element={<MinimalLayout />}>
                    <Route index element={<ProductsPage />} />
                  </Route>
                  <Route path="/categories" element={<MinimalLayout />}>
                    <Route index element={<CategoriesPage />} />
                  </Route>

                  <Route path="/services" element={<MinimalLayout />}>
                    <Route index element={<ServicesPage />} />
                  </Route>
                  <Route path="/faq" element={<MinimalLayout />}>
                    <Route index element={<FAQPage />} />
                  </Route>

                  <Route path="/profile" element={<MinimalLayout />}>
                    <Route index element={<ProfilePage />} />
                  </Route>

                  <Route path="/billing" element={<MinimalLayout />}>
                    <Route index element={<ProtectedBillingRoute />} />
                  </Route>

                  <Route path="/support/tickets" element={<MinimalLayout />}>
                    <Route index element={<SupportTicketsPage />} />
                    <Route path=":ticketId" element={<SupportTicketsPage />} />
                  </Route>

                  <Route path="/settings" element={<MinimalLayout />}>
                    <Route index element={<SettingsPage />} />
                    <Route path="languages" element={<LanguagesPage />} />
                    <Route
                      path="channel-types"
                      element={<ChannelTypesPage />}
                    />
                    <Route
                      path="categories"
                      element={<SettingsCategoriesPage />}
                    />
                    <Route path="products" element={<SettingsProductsPage />} />
                  </Route>
                  <Route path="/gdpr" element={<MinimalLayout />}>
                    <Route index element={<GdprPage />} />
                  </Route>
                  <Route path="/workspace" element={<MinimalLayout />}>
                    <Route index element={<WorkspacePage />} />
                  </Route>

                  <Route path="/offers" element={<MinimalLayout />}>
                    <Route index element={<OffersPage />} />
                  </Route>

                  <Route path="/campaigns" element={<MinimalLayout />}>
                    <Route index element={<CampaignsPage />} />
                  </Route>
                </Route>

                {/* Public Registration page via secure token (external, no platform layout) */}
                <Route
                  path="/registration/:workspaceId"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <RegisterPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/registration"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <RegisterPage />
                    </Suspense>
                  }
                />

                {/* Public Customer Profile page via secure token (external, no platform layout) */}
                <Route
                  path="/customer-profile"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <CustomerProfilePublicPage />
                    </Suspense>
                  }
                />

                {/* Public Orders page via secure token (external, no platform layout) */}
                <Route
                  path="/orders-public/:orderCode"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <OrdersPublicPage />
                    </Suspense>
                  }
                />

                {/* Legacy login redirect */}
                <Route
                  path="/login"
                  element={<Navigate to="/" replace />}
                />

                <Route path="/register" element={<Navigate to="/?action=register" replace />} />
                <Route path="/signup" element={<Navigate to="/?action=register" replace />} />
                <Route
                  path="/registration-success"
                  element={<RegistrationSuccess />}
                />

                {/* Public Feedback page via secure token */}
                <Route
                  path="/feedback"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <FeedbackPage />
                    </Suspense>
                  }
                />

                {/* Public Checkout page via secure token (external, no platform layout) */}
                <Route
                  path="/checkout"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <CheckoutPage />
                    </Suspense>
                  }
                />

                {/* Public Cart page via secure token (external, no platform layout) */}
                <Route
                  path="/cart"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <CheckoutPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/checkout-success"
                  element={<CheckoutSuccessPage />}
                />
                <Route
                  path="/order-summary/:token"
                  element={<OrderSummaryPage />}
                />
                <Route
                  path="/data-protection"
                  element={<DataProtectionPage />}
                />

                {/* Error pages */}
                <Route path="/expired" element={<ExpiredPage />} />
                <Route path="/not-found" element={<NotFoundPage />} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              
              {/* Chat Widget - Appears on all pages except /survey and /neapolis */}
              <WidgetLoader />
              <GlobalChatWidget />
            </ChatListProvider>
          </ChatProvider>
        </CustomerEditProvider>
      </BillingProvider>
    </WorkspaceProvider>
  )
}
