import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { invitationApi, type InvitationValidation } from "@/services/teamApi"
import { AlertCircle, CheckCircle, Clock, Loader2, Mail, UserPlus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

type PageState = "loading" | "valid" | "invalid" | "expired" | "already-accepted" | "success" | "error" | "auto-accepting"

/**
 * AcceptInvitePage - Handles team invitation acceptance
 * 
 * Flow:
 * 1. User clicks invite link in email → /accept-invite?token=xxx
 * 2. Page validates token
 * 3. If valid + user logged in + email matches → AUTO-ACCEPT invitation
 * 4. If valid + user not logged in → show "Log in to Accept" button
 * 5. If valid + user email mismatch → show error
 */
export function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  const [pageState, setPageState] = useState<PageState>("loading")
  const [validation, setValidation] = useState<InvitationValidation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [hasAutoAccepted, setHasAutoAccepted] = useState(false)

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem("token")
  const currentUserEmail = (() => {
    try {
      const user = localStorage.getItem("user")
      if (user) {
        const parsed = JSON.parse(user)
        return parsed.email?.toLowerCase()
      }
    } catch {
      return null
    }
    return null
  })()

  // Auto-accept function
  const autoAccept = useCallback(async () => {
    if (!token || hasAutoAccepted) return
    
    setHasAutoAccepted(true)
    setPageState("auto-accepting")

    try {
      await invitationApi.accept(token)
      setPageState("success")
      toast.success("Welcome to the team!")
      
      // Redirect to workspace selection after a short delay
      setTimeout(() => {
        navigate("/workspace-selection")
      }, 2000)
    } catch (err: any) {
      logger.error("Failed to auto-accept invitation:", err)
      const errorMessage = err.response?.data?.error || "Failed to accept invitation"
      setError(errorMessage)
      setPageState("error")
      toast.error(errorMessage)
    }
  }, [token, hasAutoAccepted, navigate])

  const validateToken = useCallback(async () => {
    if (!token) {
      setPageState("invalid")
      setError("No invitation token provided")
      return
    }

    try {
      const result = await invitationApi.validate(token)
      setValidation(result)

      if (!result.valid) {
        if (result.isExpired) {
          setPageState("expired")
          setError("This invitation has expired")
        } else {
          setPageState("invalid")
          setError("This invitation link is no longer valid")
        }
        return
      }

      // Check if user is logged in and email matches → AUTO-ACCEPT
      if (isLoggedIn && currentUserEmail) {
        if (currentUserEmail === result.email.toLowerCase()) {
          // Email matches! Auto-accept the invitation
          autoAccept()
          return
        } else {
          // Email mismatch
          setPageState("error")
          setError(`This invitation was sent to ${result.email}. You are logged in as ${currentUserEmail}. Please log out and log in with the correct account.`)
          return
        }
      }

      // Not logged in - show the invitation page
      setPageState("valid")
    } catch (err: any) {
      logger.error("Failed to validate invitation token:", err)
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to validate invitation"
      
      if (errorMessage.includes("expired")) {
        setPageState("expired")
      } else if (errorMessage.includes("already accepted") || errorMessage.includes("already a member")) {
        // If invitation was already accepted and user is logged in, redirect to workspace selection
        if (isLoggedIn) {
          logger.info("Invitation already accepted and user is logged in - redirecting to workspace selection")
          toast.success("You're already part of the team!")
          navigate("/workspace-selection")
          return
        }
        setPageState("already-accepted")
      } else {
        // For other invalid tokens, if user is logged in just redirect to workspace
        if (isLoggedIn) {
          logger.info("Invalid token but user is logged in - redirecting to workspace selection")
          navigate("/workspace-selection")
          return
        }
        setPageState("invalid")
      }
      setError(errorMessage)
    }
  }, [token, isLoggedIn, currentUserEmail, autoAccept, navigate])

  useEffect(() => {
    validateToken()
  }, [validateToken])

  const handleLoginRedirect = () => {
    // Pass invite data to login page for pre-filling registration form
    const inviteData = validation ? {
      email: validation.email,
      firstName: validation.firstName,
      lastName: validation.lastName,
      workspaceName: validation.workspaceName,
      invitedByName: validation.invitedByName,
    } : null
    
    const returnUrl = encodeURIComponent(`/accept-invite?token=${token}`)
    const inviteParam = inviteData ? `&invite=${encodeURIComponent(JSON.stringify(inviteData))}` : ''
    navigate(`/auth/login?returnUrl=${returnUrl}&mode=register${inviteParam}`)
  }

  const renderContent = () => {
    switch (pageState) {
      case "loading":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-gray-600">Validating your invitation...</p>
          </div>
        )

      case "auto-accepting":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-gray-600">Joining the team...</p>
          </div>
        )

      case "valid":
        return (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Mail className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">You're Invited!</CardTitle>
              <CardDescription className="mt-2">
                {validation?.invitedByName || 'A team member'} has invited you to join their team
                at <strong>{validation?.workspaceName}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">
                  <strong>Invitation sent to:</strong> {validation?.email}
                </p>
              </div>

              {/* User needs to log in to accept */}
              <div className="space-y-4">
                <p className="text-center text-gray-600">
                  Please log in to accept this invitation
                </p>
                <Button
                  onClick={handleLoginRedirect}
                  className="w-full gap-2"
                  size="lg"
                >
                  <UserPlus className="h-5 w-5" />
                  Log in to Accept
                </Button>
              </div>
            </CardContent>
          </>
        )

      case "expired":
        return (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <CardTitle className="text-2xl">Invitation Expired</CardTitle>
              <CardDescription className="mt-2">
                This invitation link has expired. Please ask the team administrator to send you a new invitation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/auth/login")}
                variant="outline"
                className="w-full"
              >
                Go to Login
              </Button>
            </CardContent>
          </>
        )

      case "already-accepted":
        return (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Already Accepted</CardTitle>
              <CardDescription className="mt-2">
                This invitation has already been accepted. You should already have access to the team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/workspace-selection")}
                className="w-full"
              >
                Go to Workspace Selection
              </Button>
            </CardContent>
          </>
        )

      case "success":
        return (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Welcome to the Team!</CardTitle>
              <CardDescription className="mt-2">
                You now have access to all team channels. Redirecting to workspace selection...
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </CardContent>
          </>
        )

      case "invalid":
      case "error":
      default:
        return (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
              <CardDescription className="mt-2 text-red-600">
                {error || "This invitation link is not valid."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/auth/login")}
                variant="outline"
                className="w-full"
              >
                Go to Login
              </Button>
            </CardContent>
          </>
        )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md">
        {renderContent()}
      </Card>
    </div>
  )
}
