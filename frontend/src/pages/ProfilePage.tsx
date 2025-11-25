import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole"
import { logger } from "@/lib/logger"
import {
  UserProfile,
  changePassword,
  updateUserProfile,
} from "@/services/userApi"
import { Building2, Key, Loader2, User } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export default function ProfilePage() {
  const {
    data: userData,
    isLoading: userLoading,
    isError: userError,
  } = useCurrentUser()
  const { workspace } = useWorkspace()
  const { isSuperAdmin } = useWorkspaceRole(workspace?.id)
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [user, setUser] = useState<UserProfile & {
    companyName?: string
    vatNumber?: string
    website?: string
    billingPhone?: string
    billingAddress?: string
  }>({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    companyName: "",
    vatNumber: "",
    website: "",
    billingPhone: "",
    billingAddress: "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (userData) {
      setUser({
        ...userData,
        companyName: (userData as any).companyName || "",
        vatNumber: (userData as any).vatNumber || "",
        website: (userData as any).website || "",
        billingPhone: (userData as any).billingPhone || "",
        billingAddress: (userData as any).billingAddress || "",
      })
    }
  }, [userData])

  const handleFieldChange = (field: string, value: string) => {
    setUser((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePasswordFieldChange = (field: string, value: string) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const updatedUser = await updateUserProfile({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        companyName: user.companyName,
        vatNumber: user.vatNumber,
        website: user.website,
        billingPhone: user.billingPhone,
        billingAddress: user.billingAddress,
      })
      setUser({
        ...updatedUser,
        companyName: (updatedUser as any).companyName || "",
        vatNumber: (updatedUser as any).vatNumber || "",
        website: (updatedUser as any).website || "",
        billingPhone: (updatedUser as any).billingPhone || "",
        billingAddress: (updatedUser as any).billingAddress || "",
      })
      toast.success("Profile updated successfully")
    } catch (error) {
      logger.error("Error updating profile:", error)
      toast.error("Failed to update profile")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    // Validation
    if (!passwordData.currentPassword) {
      toast.error("Current password is required")
      return
    }
    
    if (!passwordData.newPassword) {
      toast.error("New password is required")
      return
    }
    
    if (passwordData.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })
      toast.success("Password changed successfully")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setShowPasswordDialog(false)
    } catch (error: any) {
      logger.error("Error changing password:", error)
      const errorMessage = error?.response?.data?.message || "Failed to change password"
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (userError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <p className="text-red-500">Error loading profile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal information and billing details
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowPasswordDialog(true)}
          className="gap-2"
        >
          <Key className="h-4 w-4" />
          Change Password
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={user.firstName || ""}
                onChange={(e) => handleFieldChange("firstName", e.target.value)}
                placeholder="Your first name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={user.lastName || ""}
                onChange={(e) => handleFieldChange("lastName", e.target.value)}
                placeholder="Your last name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                placeholder="your.email@example.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing Information - ONLY for SUPER_ADMIN (Owner) */}
        {isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Billing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={user.companyName || ""}
                  onChange={(e) => handleFieldChange("companyName", e.target.value)}
                  placeholder="Your company name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  value={user.vatNumber || ""}
                  onChange={(e) => handleFieldChange("vatNumber", e.target.value)}
                  placeholder="IT12345678901"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={user.website || ""}
                  onChange={(e) => handleFieldChange("website", e.target.value)}
                  placeholder="https://www.example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingPhone">Phone</Label>
                <Input
                  id="billingPhone"
                  type="tel"
                  value={user.billingPhone || ""}
                  onChange={(e) => handleFieldChange("billingPhone", e.target.value)}
                  placeholder="+39 123 456 7890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingAddress">Address</Label>
                <Input
                  id="billingAddress"
                  value={user.billingAddress || ""}
                  onChange={(e) => handleFieldChange("billingAddress", e.target.value)}
                  placeholder="Via Roma 1, 00100 Rome, Italy"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="gap-2"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one. Password must be at least 8 characters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  handlePasswordFieldChange("currentPassword", e.target.value)
                }
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  handlePasswordFieldChange("newPassword", e.target.value)
                }
                placeholder="Enter new password (min 8 characters)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  handlePasswordFieldChange("confirmPassword", e.target.value)
                }
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false)
                setPasswordData({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                })
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
