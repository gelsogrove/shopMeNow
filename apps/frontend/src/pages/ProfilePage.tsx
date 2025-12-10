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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { logger } from "@/lib/logger"
import { api } from "@/services/api"
import {
  UserProfile,
  changePassword,
  updateUserProfile,
  setPassword,
  deleteMyAccount,
} from "@/services/userApi"
import { Building2, Key, Loader2, User, Phone, Trash2, AlertTriangle, Globe, ImageIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../lib/toast"
import { ImageCropUpload } from "@/components/shared/ImageCropUpload"

// Supported languages for user interface
const SUPPORTED_LANGUAGES = [
  { code: "ENG", name: "English", flag: "🇬🇧" },
  { code: "ITA", name: "Italiano", flag: "🇮🇹" },
  { code: "ESP", name: "Español", flag: "🇪🇸" },
  { code: "POR", name: "Português", flag: "🇵🇹" },
  { code: "FRA", name: "Français", flag: "🇫🇷" },
  { code: "DEU", name: "Deutsch", flag: "🇩🇪" },
]

export default function ProfilePage() {
  const {
    data: userData,
    isLoading: userLoading,
    isError: userError,
  } = useCurrentUser()
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false)
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const navigate = useNavigate()
  const [user, setUser] = useState<UserProfile & {
    phoneNumber?: string
    language?: string
    companyName?: string
    vatNumber?: string
    website?: string
    billingPhone?: string
    billingAddress?: string
    authProvider?: string
    hasPassword?: boolean
    logo?: string
  }>({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    language: "ENG",
    companyName: "",
    vatNumber: "",
    website: "",
    billingPhone: "",
    billingAddress: "",
    logo: "",
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [newPasswordData, setNewPasswordData] = useState({
    password: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (userData) {
      setUser({
        ...userData,
        phoneNumber: (userData as any).phoneNumber || "",
        language: (userData as any).language || "ENG",
        companyName: (userData as any).companyName || "",
        vatNumber: (userData as any).vatNumber || "",
        website: (userData as any).website || "",
        billingPhone: (userData as any).billingPhone || "",
        billingAddress: (userData as any).billingAddress || "",
        authProvider: (userData as any).authProvider || "email",
        hasPassword: (userData as any).hasPassword !== false, // Default to true unless explicitly false
        logo: (userData as any).logo || "",
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
      const updateData: any = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        language: user.language,
        companyName: user.companyName,
        vatNumber: user.vatNumber,
        website: user.website,
        billingPhone: user.billingPhone,
        billingAddress: user.billingAddress,
      }
      
      // Include logo file if selected
      if (logoFile) {
        updateData.logo = logoFile
        logger.info("📸 Logo file included in update:", { name: logoFile.name, size: logoFile.size, type: logoFile.type })
      } else {
        logger.info("📸 No logo file selected")
      }
      
      const updatedUser = await updateUserProfile(updateData)
      setUser({
        ...updatedUser,
        phoneNumber: (updatedUser as any).phoneNumber || "",
        language: (updatedUser as any).language || "ENG",
        companyName: (updatedUser as any).companyName || "",
        vatNumber: (updatedUser as any).vatNumber || "",
        website: (updatedUser as any).website || "",
        billingPhone: (updatedUser as any).billingPhone || "",
        billingAddress: (updatedUser as any).billingAddress || "",
        logo: (updatedUser as any).logo || "",
      })
      setLogoFile(null) // Clear the pending file after save
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

  const handleSetNewPassword = async () => {
    // Validate password
    if (!newPasswordData.password) {
      toast.error("Password is required")
      return
    }
    
    if (newPasswordData.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    if (newPasswordData.password !== newPasswordData.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      await setPassword(newPasswordData.password)
      toast.success("Password set successfully! You can now use email/password login.")
      setNewPasswordData({
        password: "",
        confirmPassword: "",
      })
      setShowSetPasswordDialog(false)
      // Refresh user data to update hasPassword
      window.location.reload()
    } catch (error: any) {
      logger.error("Error setting password:", error)
      const errorMessage = error?.response?.data?.message || "Failed to set password"
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type DELETE to confirm")
      return
    }

    setIsDeletingAccount(true)
    try {
      const result = await deleteMyAccount("User requested account deletion")
      logger.info("Account deletion initiated:", result)
      toast.success("Your account has been deleted. You will be logged out.")
      
      // 🛡️ CRITICAL: Full logout after account delete (Andrea's request)
      try {
        await api.post("/auth/logout")
      } catch (logoutError) {
        logger.error("Error calling logout API:", logoutError)
      }
      
      // Clear ALL storage (security)
      logger.info("🧹 [DELETE ACCOUNT] Clearing ALL storage")
      localStorage.clear()
      sessionStorage.clear()
      
      setTimeout(() => {
        navigate("/login")
      }, 1500)
    } catch (error: any) {
      logger.error("Error deleting account:", error)
      const errorMessage = error?.response?.data?.message || "Failed to delete account"
      toast.error(errorMessage)
    } finally {
      setIsDeletingAccount(false)
      setShowDeleteAccountDialog(false)
      setDeleteConfirmation("")
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
          <h1 className="text-2xl font-bold text-green-600">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal information and account settings
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowDeleteAccountDialog(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>

          {user.hasPassword ? (
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(true)}
              className="gap-2"
            >
              <Key className="h-4 w-4" />
              Change Password
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowSetPasswordDialog(true)}
              className="gap-2"
            >
              <Key className="h-4 w-4" />
              Set Password
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="gap-2 bg-green-600 hover:bg-green-700"
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
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
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

            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Phone Number
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={user.phoneNumber || ""}
                onChange={(e) => handleFieldChange("phoneNumber", e.target.value)}
                placeholder="+39 123 456 7890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language" className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Preferred Language
              </Label>
              <Select
                value={user.language || "ENG"}
                onValueChange={(value) => handleFieldChange("language", value)}
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Billing Information */}
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Building2 className="h-5 w-5" />
                Billing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Logo */}
              <div className="space-y-2">
                <ImageCropUpload
                  onImageSelected={(file) => setLogoFile(file)}
                  currentImageUrl={user.logo}
                  label="Company Logo"
                  placeholder="logo"
                  editIconStyle={true}
                />
              </div>

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
      </div>



      {/* Delete Account Dialog */}
      <Dialog open={showDeleteAccountDialog} onOpenChange={(open) => {
        setShowDeleteAccountDialog(open)
        if (!open) setDeleteConfirmation("")
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                This action will soft-delete your account. Your data will be retained for <strong>90 days</strong> and can be recovered by contacting support.
              </p>
              <p className="font-medium text-destructive">
                After 90 days, all your data will be permanently deleted including:
                your profile, workspaces, customers, orders, and chat history.
              </p>
              <p className="mt-4">
                To confirm, type <span className="font-mono font-bold">DELETE</span> below:
              </p>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="font-mono"
            autoComplete="off"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteAccountDialog(false)
                setDeleteConfirmation("")
              }}
              disabled={isDeletingAccount}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || deleteConfirmation !== "DELETE"}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete My Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Set Password Dialog (for OAuth users) */}
      <Dialog open={showSetPasswordDialog} onOpenChange={setShowSetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>
              Set a password to enable email/password login in addition to your Google account.
              This will allow you to use the 2FA reset feature if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPasswordData.password}
                onChange={(e) =>
                  setNewPasswordData((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Enter your new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={newPasswordData.confirmPassword}
                onChange={(e) =>
                  setNewPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                placeholder="Confirm your new password"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Password must be at least 8 characters long.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSetPasswordDialog(false)
                setNewPasswordData({
                  password: "",
                  confirmPassword: "",
                })
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSetNewPassword} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting...
                </>
              ) : (
                "Set Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
