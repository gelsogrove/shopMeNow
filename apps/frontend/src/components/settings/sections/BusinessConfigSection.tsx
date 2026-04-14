/**
 * BusinessConfigSection - Configurazione Business
 * Campi: name, notificationEmail, url, businessType, currency, channelMode
 */
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Store, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUPPORTED_CURRENCIES } from "@/utils/format"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface BusinessConfigSectionProps {
  formData: {
    name: string
    adminEmail: string
    url: string
    businessType: string
    currency: string
    defaultLanguage: string
    channelMode: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
    enableWhatsapp: boolean
    enableWidget: boolean
    address: string
    registrationPage: string
    requireManualApproval: boolean
  }
  errors: Record<string, string>
  canEdit: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
}

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail & E-commerce", desc: "Online or physical store" },
  { value: "restaurant", label: "Restaurant & Food", desc: "Food services" },
  { value: "healthcare", label: "Healthcare", desc: "Medical services" },
  { value: "education", label: "Education", desc: "Schools, courses" },
  { value: "finance", label: "Finance & Banking", desc: "Financial services" },
  { value: "realestate", label: "Real Estate", desc: "Real estate services" },
  { value: "technology", label: "Technology & IT", desc: "Tech services" },
  { value: "other", label: "Other", desc: "Other business type" },
]

export function BusinessConfigSection({
  formData,
  errors,
  canEdit,
  onFieldChange,
  onFieldFocus,
}: BusinessConfigSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Store className="h-6 w-6 text-purple-600" />
          Business Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Define your business type and main information
        </p>
      </div>

      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-white">
          <CardTitle className="text-base font-semibold">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Channel Name */}
            <div className="space-y-2" onFocus={() => onFieldFocus?.("businessName")}>
              <Label htmlFor="name">
                Channel Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onFieldChange("name", e.target.value)}
                placeholder="e.g. My Restaurant, Tech Support"
                disabled={!canEdit}
                className={cn(errors.name && "border-red-500")}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>

            {/* Business Type */}
            <div className="space-y-2" onFocus={() => onFieldFocus?.("businessType")}>
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => onFieldChange("businessType", value)}
                disabled={!canEdit}
              >
                <SelectTrigger id="businessType">
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Admin Email */}
            <div className="space-y-2" onFocus={() => onFieldFocus?.("businessEmail")}>
              <Label htmlFor="adminEmail">Business Email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => onFieldChange("adminEmail", e.target.value)}
                placeholder="admin@example.com"
                disabled={!canEdit}
                className={cn(errors.adminEmail && "border-red-500")}
              />
              {errors.adminEmail && <p className="text-xs text-red-600">{errors.adminEmail}</p>}
            </div>

            {/* Website URL */}
            <div className="space-y-2" onFocus={() => onFieldFocus?.("businessWebsite")}>
              <Label htmlFor="url">Website</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => onFieldChange("url", e.target.value)}
                placeholder="https://mybusiness.com"
                disabled={!canEdit}
              />
            </div>

            {/* Physical Address */}
            <div className="space-y-2 md:col-span-2" onFocus={() => onFieldFocus?.("businessAddress")}>
              <Label htmlFor="address">Physical Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => onFieldChange("address", e.target.value)}
                placeholder="e.g. 123 Main Street, City, Country"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">Used when customers ask "Where are you located?"</p>
            </div>

            {/* Registration Page URL */}
            <div className="space-y-2 md:col-span-2" onFocus={() => onFieldFocus?.("registrationPage")}>
              <Label htmlFor="registrationPage">Customer Registration Page</Label>
              <Input
                id="registrationPage"
                type="url"
                value={formData.registrationPage || ""}
                onChange={(e) => onFieldChange("registrationPage", e.target.value)}
                placeholder="https://echatbot.ai/registration/{workspaceId}"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">
                Custom URL for customer registration. Leave empty to use the default eChatbot registration page.
              </p>
            </div>

            {/* Require Manual Approval */}
            <div className="space-y-2 md:col-span-2" onFocus={() => onFieldFocus?.("requireManualApproval")}>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="requireManualApproval"
                  checked={formData.requireManualApproval || false}
                  onChange={(e) => onFieldChange("requireManualApproval", e.target.checked)}
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <Label htmlFor="requireManualApproval" className="cursor-pointer">
                  Require Manual Approval for New Customers
                </Label>
              </div>
              <p className="text-xs text-gray-500 ml-7">
                When enabled, new customers will be in "Pending Approval" status after registration. 
                An admin must manually approve them before they can access full features.
              </p>
            </div>

            {/* Currency */}
            <div className="space-y-2 md:col-span-2" data-focus-key="defaultLanguage">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => onFieldChange("currency", value)}
                disabled={!canEdit}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code} - {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default Language */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="defaultLanguage">Default Language</Label>
              <Select
                value={formData.defaultLanguage}
                onValueChange={(value) => onFieldChange("defaultLanguage", value)}
                disabled={!canEdit}
              >
                <SelectTrigger id="defaultLanguage">
                  <SelectValue placeholder="Select default language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it">🇮🇹 Italian</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                  <SelectItem value="pt">🇵🇹 Portuguese</SelectItem>
                  <SelectItem value="fr">🇫🇷 French</SelectItem>
                  <SelectItem value="de">🇩🇪 German</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Language used when customer language cannot be detected
              </p>
            </div>

            {/* Channel Mode — immutable after creation (user must delete + recreate workspace to change) */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium text-gray-900">
                Channel Mode
              </Label>
              <Select
                value={formData.channelMode}
                onValueChange={() => {}}
                disabled={true}
              >
                <SelectTrigger className="opacity-70">
                  <SelectValue placeholder="Select channel mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ECOMMERCE">E-commerce — sell products &amp; services</SelectItem>
                  <SelectItem value="INFORMATIONAL">Informational — FAQ &amp; customer support</SelectItem>
                  <SelectItem value="FLOW">Flow — custom chatbot flow</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-amber-600">
                Channel mode is set at creation and cannot be changed. To switch mode, delete this workspace and create a new one.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
