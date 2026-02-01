/**
 * BusinessConfigSection - Configurazione Business
 * Campi: name, notificationEmail, url, businessType, currency, sellsProductsAndServices
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
import { Store } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUPPORTED_CURRENCIES } from "@/utils/format"

interface BusinessConfigSectionProps {
  formData: {
    name: string
    adminEmail: string
    url: string
    businessType: string
    currency: string
    sellsProductsAndServices: boolean
    enableWhatsapp: boolean
    enableWidget: boolean
    address: string
    registrationPage: string
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
                placeholder="https://mybusiness.com/register"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-500">Custom URL for customer registration. Used by chatbot when linking to registration.</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
