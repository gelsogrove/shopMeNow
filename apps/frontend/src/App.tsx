import QuestionnairePage from "@/pages/QuestionnairePage"
import GdprPage from "@/pages/GdprPage"
import { SettingsPage } from "@/pages/SettingsPage"
import WidgetPage from "@/pages/WidgetPage"
import WidgetSettingsPage from "@/pages/WidgetSettingsPage"
import WidgetEmbedPage from "@/pages/WidgetEmbedPage"
import WidgetTestPage from "@/pages/WidgetTestPage"
import { LegalDocumentPage } from "@/pages/LegalDocumentPage"
import { FeaturesPage } from "@/pages/FeaturesPage"
import { HumanSupportPage } from "@/pages/HumanSupportPage"
import { AppointmentBookingPage } from "@/pages/AppointmentBookingPage"
import { CrmIntegrationPage } from "@/pages/CrmIntegrationPage"
import { SmartPushAiPage } from "@/pages/SmartPushAiPage"
import { TeamCollaborationPage } from "@/pages/TeamCollaborationPage"
import { PrivacyByDesignPage } from "@/pages/PrivacyByDesignPage"
import { LaundryServicePage } from "@/pages/LaundryServicePage"
import { FranchisingPage } from "@/pages/FranchisingPage"
import { RealEstatePage } from "@/pages/RealEstatePage"
import { ContactPage } from "@/pages/ContactPage"
import RequestAccessPage from "@/pages/RequestAccessPage"
import { storage } from "@/lib/storage"

// Sales-led pivot: /pricing is no longer a public marketing page.
// Authenticated users can still see their plan inside the app (Settings /
// Billing). Unauthenticated visitors get sent to /login — pricing is now
// part of the manual sales conversation, not a public price list.
import { NeapolisPage } from "@/pages/NeapolisPage"
import OnboardingPage from "@/pages/OnboardingPage"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { Toaster } from "sonner"
import { MinimalLayout } from "./components/layout/MinimalLayout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { WidgetLoader } from "./components/WidgetLoader"
import { ChatProvider } from "./contexts/ChatContext"
import { AcceptInvitePage } from "./pages/AcceptInvitePage"
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
import { AppointmentsPage } from "./pages/AppointmentsPage"
import { BusinessHoursPage } from "./pages/BusinessHoursPage"
import { BlackoutPeriodsPage } from "./pages/BlackoutPeriodsPage"
import { CategoriesPage as SettingsCategoriesPage } from "./pages/settings/CategoriesPage"
import { ChannelTypesPage } from "./pages/settings/ChannelTypesPage"
import { LanguagesPage } from "./pages/settings/LanguagesPage"

import { ProductsPage as SettingsProductsPage } from "./pages/settings/ProductsPage"

import { Suspense, lazy, useEffect } from "react"
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
const DemoWidgetPage = lazy(() => import("./pages/DemoWidgetPage"))

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

/**
 * F50 — CustomChatbotGuard
 *
 * Defensive route guard: when the active workspace runs a custom chatbot
 * module (`workspace.customChatbotId` is set, e.g. "ecolaundry"), the entire
 * standard-platform feature surface (catalog, FAQ, appointments, agent
 * configuration, sales, analytics, etc.) is not used. The sidebar already
 * hides those entries; this guard catches users who navigate directly via
 * URL and redirects them back to /chat — the meaningful home in custom
 * chatbot mode.
 *
 * Wrap any Route element that must be unreachable in custom chatbot mode:
 *
 *   <Route path="/products" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
 *     ...
 *   </Route>
 */
function CustomChatbotGuard({ children }: { children: React.ReactNode }) {
  const { workspace, loading } = useWorkspace()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    )
  }
  if (workspace?.customChatbotId) {
    return <Navigate to="/chat" replace />
  }
  return <>{children}</>
}

// 🛑 eChatbot HQ support widget DISABLED everywhere (home, subpages, app) —
// Andrea: "non serve il widget grazie". Kept as a no-op so the render site in
// AppWithProviders stays valid; flip back to the ChatWidget render to restore.
function GlobalChatWidget() {
  return null
}

// Public standalone routes that do NOT use the main-app JWT: the login page
// itself has no token yet, demo playgrounds authenticate with their own
// `playgroundToken`, and the operator/support pages are token-in-URL. The
// expiry guard must skip them, otherwise a visitor with no main-app token
// (isTokenExpired() === true) is bounced to "/" the instant the page mounts —
// which makes /login unreachable.
export const PUBLIC_PATH_PREFIXES = ["/login", "/demo/", "/support-chat", "/operator-dashboard"]

// True when `path` is a public standalone route that must NOT be policed by
// the main-app token-expiry guard. Exported so the regression test can pin the
// exemption list directly without mounting the router.
export function isPublicGuardExemptPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix)
  )
}

function TokenExpiryGuard() {
  useEffect(() => {
    const checkExpiry = () => {
      const path = window.location.pathname
      if (storage.isTokenExpired() && path !== "/" && !isPublicGuardExemptPath(path)) {
        storage.clearAppState()
        window.location.href = "/"
      }
    }
    checkExpiry()
    document.addEventListener("visibilitychange", checkExpiry)
    return () => document.removeEventListener("visibilitychange", checkExpiry)
  }, [])
  return null
}

export function App() {
  return (
    <BrowserRouter>
      <TokenExpiryGuard />
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
        
        {/* Demowash public demo — renders the real embeddable ChatWidget so a
            visitor can try the live chatbot (name + language + first message),
            exactly like the production widget. Resolves the workspaceId from the
            slug via the ABSOLUTE API base (works in production, unlike the
            relative-path Playground). */}
        <Route
          path="/demo/demowash/*"
          element={
            <Suspense
              fallback={
                <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
              }
            >
              <DemoWidgetPage />
            </Suspense>
          }
        />

        {/* DemoCasa — real-estate agency demo. Same DemoWidgetPage, branded by
            slug ("democasa"). Resolves the workspace via customChatbotId="democasa". */}
        <Route
          path="/demo/democasa/*"
          element={
            <Suspense
              fallback={
                <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
                  <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
              }
            >
              <DemoWidgetPage />
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
                  {/* Sales-led pivot: no more self-service signup. Both
                      legacy auth/signup and auth/register paths funnel
                      visitors to the lead-capture form instead. */}
                  <Route path="signup" element={<Navigate to="/request-access" replace />} />
                  <Route path="register" element={<Navigate to="/request-access" replace />} />
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
                <Route path="/widget-to-whatsapp" element={<Navigate to="/" replace />} />
                <Route path="/human-support" element={<HumanSupportPage />} />
                <Route path="/laundry-service" element={<LaundryServicePage />} />
                <Route path="/franchising" element={<FranchisingPage />} />
                <Route path="/real-estate" element={<RealEstatePage />} />
                <Route path="/appointment-booking" element={<AppointmentBookingPage />} />
                <Route path="/smart-push-ai" element={<SmartPushAiPage />} />
                <Route path="/crm-integration" element={<CrmIntegrationPage />} />
                <Route path="/team-collaboration" element={<TeamCollaborationPage />} />
                <Route path="/privacy-by-design" element={<PrivacyByDesignPage />} />
                <Route path="/pricing" element={<Navigate to="/" replace />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/request-access" element={<RequestAccessPage />} />
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
                  <Route path="/analytics" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<ProtectedAnalyticsRoute />} />
                  </Route>
                  {/* F50 — Andrea 2026-05-13: Visual Flow Builder ("Agent Configuration")
                      permanently deprecated for ALL workspaces. The page caused unacceptable
                      latency in production (1 LLM call per node). Replaced by code-based
                      custom chatbot modules (`apps/backend/custom-<name>/`). The route is
                      kept as a universal redirect so any bookmarked link lands on /chat. */}
                  <Route path="/agents" element={<Navigate to="/chat" replace />} />
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
                  <Route path="/sales" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<SalesPage />} />
                  </Route>
                  <Route path="/admin/orders" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<OrdersPage />} />
                  </Route>
                  <Route path="/products" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<ProductsPage />} />
                  </Route>
                  <Route path="/categories" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<CategoriesPage />} />
                  </Route>

                  <Route path="/services" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<ServicesPage />} />
                  </Route>

                  {/* Appointment Booking Routes */}
                  <Route path="/appointments" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<AppointmentsPage />} />
                  </Route>
                  <Route path="/business-hours" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<BusinessHoursPage />} />
                  </Route>
                  <Route path="/blackout-periods" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
                    <Route index element={<BlackoutPeriodsPage />} />
                  </Route>

                  <Route path="/faq" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
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

                  <Route path="/offers" element={<CustomChatbotGuard><MinimalLayout /></CustomChatbotGuard>}>
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

                {/* Sales-led pivot: /login serves the full LoginPage
                    with the auth card visible (existing customers entry
                    point + Andrea's dev access). / serves the SAME
                    LoginPage but with the auth card hidden — landing
                    only, leads flow through /request-access. The card
                    visibility is decided inside LoginPage via useLocation. */}
                <Route path="/login" element={<LoginPage />} />

                <Route path="/register" element={<Navigate to="/request-access" replace />} />
                <Route path="/signup" element={<Navigate to="/request-access" replace />} />
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
