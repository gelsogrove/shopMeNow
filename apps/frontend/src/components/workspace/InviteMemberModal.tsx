import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { invitationApi } from "@/services/teamApi"
import { useLanguage } from "@/contexts/LanguageContext"
import { Loader2, Mail, Send, AlertCircle } from "lucide-react"
import { useState } from "react"

interface InviteMemberModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSuccess: () => void
}

/**
 * Modal dialog for inviting new team members via email
 * Only SUPER_ADMIN can use this - validation is done at API level
 * 
 * Error handling:
 * - TEAM_MEMBER_LIMIT_REACHED: Shows upgrade message with i18n translations
 * - PLAN_LIMIT_REACHED: Generic plan limit error
 * - INVALID_EMAIL: Email validation error
 * - Other errors: Shows error message from backend
 */
export function InviteMemberModal({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: InviteMemberModalProps) {
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrorCode(null)

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address")
      return
    }

    setIsLoading(true)

    try {
      await invitationApi.create(workspaceId, { 
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      })
      toast.success(`Invitation sent to ${email}`)
      setEmail("")
      setFirstName("")
      setLastName("")
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      const status = err.response?.status
      const data = err.response?.data
      const code = data?.code || data?.error

      // Handle plan limit errors with translations
      if (status === 403 && code === "TEAM_MEMBER_LIMIT_REACHED") {
        setErrorCode("TEAM_MEMBER_LIMIT_REACHED")
        const errorMessage = t("error.teamMemberLimitReached")
        setError(errorMessage)
        toast.error(errorMessage)
        return
      }

      // Handle generic plan limit errors
      if (status === 403 && code === "PLAN_LIMIT_REACHED") {
        setErrorCode("PLAN_LIMIT_REACHED")
        const errorMessage = data?.message || t("error.planLimitReached") || "Plan limit reached"
        setError(errorMessage)
        toast.error(errorMessage)
        return
      }

      // Default error handling
      const message = data?.message || data?.error || err.message || "Failed to send invitation"
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setEmail("")
      setFirstName("")
      setLastName("")
      setError(null)
      setErrorCode(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new team member. They will have
            access to all your channels.
          </DialogDescription>
        </DialogHeader>

        {/* Plan limit error banner */}
        {errorCode === "TEAM_MEMBER_LIMIT_REACHED" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="text-amber-800 font-medium">{t("error.teamMemberLimitReached")}</p>
              <p className="text-amber-700 mt-1">{t("error.teamMemberLimitUpgrade")}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" data-lpignore="true" data-form-type="other">
          <div className="space-y-4 py-4">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading || errorCode === "TEAM_MEMBER_LIMIT_REACHED"}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoading || errorCode === "TEAM_MEMBER_LIMIT_REACHED"}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>
            </div>
            
            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                name="invite-email-no-autocomplete"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || errorCode === "TEAM_MEMBER_LIMIT_REACHED"}
                autoFocus
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
              />
              {error && errorCode !== "TEAM_MEMBER_LIMIT_REACHED" && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !email.trim() || errorCode === "TEAM_MEMBER_LIMIT_REACHED"}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
