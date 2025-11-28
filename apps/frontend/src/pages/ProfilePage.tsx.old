import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { logger } from "@/lib/logger"
import {
  UserProfile,
  changePassword,
  updateUserProfile,
} from "@/services/userApi"
import { Loader2, User } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export default function ProfilePage() {
  const {
    data: userData,
    isLoading: userLoading,
    isError: userError,
  } = useCurrentUser()
  const [isLoading, setIsLoading] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [user, setUser] = useState<UserProfile>({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (userData) {
      // Simulate loading time for better UX
      setTimeout(() => {
        setUser(userData)
        setIsPageLoading(false)
      }, 800) // 800ms loading time
    }
  }, [userData])

  const handleFieldChange = (field: keyof UserProfile, value: string) => {
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
      })
      setUser(updatedUser)
      toast.success("Profile updated successfully")
    } catch (error) {
      logger.error("Error updating profile:", error)
      toast.error("Failed to update profile")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
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
    } catch (error) {
      logger.error("Error changing password:", error)
      toast.error("Failed to change password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        <User className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      {isPageLoading ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Loading Profile
            </h2>
            <p className="text-gray-600">Stiamo caricando i tuoi dati...</p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-gray-700">
                  First Name
                </Label>
                <Input
                  value={user.firstName || ""}
                  onChange={(e) =>
                    handleFieldChange("firstName", e.target.value)
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700">
                  Last Name
                </Label>
                <Input
                  value={user.lastName || ""}
                  onChange={(e) =>
                    handleFieldChange("lastName", e.target.value)
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  value={user.email || ""}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  className="mt-1"
                  type="email"
                />
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowPasswordDialog(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Change Password
                </Button>

                <Button
                  variant="default"
                  onClick={handleSave}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and a new password below.
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
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(false)}
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
