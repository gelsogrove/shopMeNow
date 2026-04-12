import { useState, useEffect, type CSSProperties } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Loader2, Save, User, Mail, Phone, Building, Globe, Bell } from "lucide-react"

interface WidgetProfilePanelProps {
  profileData: Record<string, unknown> | null
  loading: boolean
  saving: boolean
  error: string | null
  primaryColor: string
  onSave: (data: Record<string, unknown>) => void
  onBack: () => void
}

export function WidgetProfilePanel({
  profileData,
  loading,
  saving,
  error,
  primaryColor,
  onSave,
  onBack,
}: WidgetProfilePanelProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [language, setLanguage] = useState("en")
  const [pushNotificationsConsent, setPushNotificationsConsent] = useState(false)

  useEffect(() => {
    if (profileData) {
      setName((profileData.name as string) || "")
      setEmail((profileData.email as string) || "")
      setPhone((profileData.phone as string) || "")
      setCompany((profileData.company as string) || "")
      setLanguage((profileData.language as string) || "en")
      setPushNotificationsConsent((profileData.pushNotificationsConsent as boolean) || false)
    }
  }, [profileData])

  const handleSubmit = () => {
    onSave({ name, email, company, language, pushNotificationsConsent })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="flex-1 bg-slate-50 px-5 py-4">
        <div className="space-y-4">
          {/* Back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: primaryColor }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to chat
          </button>

          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5" style={{ color: primaryColor }} />
            My Profile
          </h3>

          {error && (
            <p className="text-xs text-red-500 text-center bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <User className="w-3.5 h-3.5" /> Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 placeholder-slate-400"
              style={{ "--tw-ring-color": primaryColor } as CSSProperties}
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 placeholder-slate-400"
              style={{ "--tw-ring-color": primaryColor } as CSSProperties}
            />
          </div>

          {/* Phone (read-only) */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Phone className="w-3.5 h-3.5" /> Phone
            </label>
            <input
              type="tel"
              value={phone}
              disabled
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
            />
          </div>

          {/* Company */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Building className="w-3.5 h-3.5" /> Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Your company"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1 placeholder-slate-400"
              style={{ "--tw-ring-color": primaryColor } as CSSProperties}
            />
          </div>

          {/* Language */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Globe className="w-3.5 h-3.5" /> Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-1"
              style={{ "--tw-ring-color": primaryColor } as CSSProperties}
            >
              <option value="en">English</option>
              <option value="it">Italiano</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          {/* Push Notifications */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 hover:bg-slate-150 transition-colors">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-600" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">WhatsApp Notifications</span>
                  <span className="text-xs text-slate-500">Receive message updates</span>
                </div>
              </div>
              <Switch
                checked={pushNotificationsConsent}
                onCheckedChange={setPushNotificationsConsent}
              />
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Save footer */}
      <div className="border-t border-gray-200 p-3 sm:p-4">
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="w-full py-3 rounded-2xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.98] transition-all disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Profile
            </>
          )}
        </button>
      </div>
    </>
  )
}
