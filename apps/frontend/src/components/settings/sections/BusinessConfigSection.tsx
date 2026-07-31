/**
 * BusinessConfigSection - Configurazione Business
 * Campi: name, notificationEmail, url, businessType, currency, channelMode
 */
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Store, Trash2, Loader2, AlertTriangle, Radio } from "lucide-react"
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
    channelMode: 'ECOMMERCE' | 'INFORMATIONAL' | 'FLOW'
    channelStatus: boolean
    enableWhatsapp: boolean
    enableWidget: boolean
    address: string
    hasProductCatalog: boolean
    hasCart: boolean
    hasOrderTracking: boolean
  }
  errors: Record<string, string>
  canEdit: boolean
  isSuperAdmin?: boolean
  isDeleting?: boolean
  onFieldChange: (field: string, value: any) => void
  onFieldFocus?: (fieldKey: string) => void
  onDeleteWorkspace?: () => void
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

// Documentation only (see Workspace.enabledLanguages in schema.prisma) — the
// chatbot detects language from the customer's message regardless of this
// list; it exists so the team can track which languages a client requested.
const AVAILABLE_LANGUAGES = [
  { code: "en", label: "🇬🇧 English" },
  { code: "it", label: "🇮🇹 Italian" },
  { code: "fr", label: "🇫🇷 French" },
  { code: "de", label: "🇩🇪 German" },
  { code: "da", label: "🇩🇰 Danish" },
  { code: "es", label: "🇪🇸 Spanish" },
  { code: "nl", label: "🇳🇱 Dutch" },
]

export function BusinessConfigSection({
  formData,
  errors,
  canEdit,
  isSuperAdmin,
  isDeleting,
  onFieldChange,
  onFieldFocus,
  onDeleteWorkspace,
}: BusinessConfigSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Store className="h-6 w-6 text-purple-600" />
          Preferences
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Define your business type and main information
        </p>
      </div>

      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 text-purple-600" />
            Company Information
          </CardTitle>
          <p className="text-sm text-gray-500">
            Details the chatbot uses when customers ask about your business
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Business Type */}
            <div className="space-y-2" onFocus={() => onFieldFocus?.("businessType")}>
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) => onFieldChange("businessType", value)}
                disabled={!canEdit}
              >
                <SelectTrigger id="businessType" className="[&>span]:line-clamp-none">
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

          </div>
        </CardContent>
      </Card>

      {/* Channel — currency + immutable channel mode */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center justify-between" data-focus-key="channelStatus">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Radio className="h-5 w-5 text-purple-600" />
              Channel
            </CardTitle>
            {canEdit && (
              <Switch
                checked={formData.channelStatus}
                onCheckedChange={(checked) => onFieldChange("channelStatus", checked)}
              />
            )}
          </div>
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

            {/* Currency */}
            <div className="space-y-2">
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

            {/* Channel Mode — immutable after creation (blocked server-side too,
                see workspace.service.ts CHANNEL_MODE_IMMUTABLE). The dropdown
                is openable so the three types are visible/browsable, but
                selecting one is a no-op — it never reaches formData, so
                Save can't submit a change the backend would reject anyway. */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">
                Channel Mode
              </Label>
              <Select
                value={formData.channelMode}
                onValueChange={() => {}}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ECOMMERCE">Ecommerce</SelectItem>
                  <SelectItem value="INFORMATIONAL">Informational</SelectItem>
                  <SelectItem value="FLOW">Flow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone - Delete Workspace (Super Admin only) */}
      {isSuperAdmin && (
        <Card className="border-red-200">
          <CardHeader className="border-b bg-gradient-to-r from-red-50 to-white">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Delete this workspace and all data. Recoverable within 90 days.
              </p>
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-100 hover:text-red-700"
                size="sm"
                onClick={onDeleteWorkspace}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Workspace
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
