import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { 
  LogIn, 
  UserPlus, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  MessageCircle,
  Save
} from 'lucide-react'

interface FlagConfig {
  key: string
  value: boolean
  description: string | null
  icon: React.ReactNode
  title: string
}

export function PlatformsPage() {
  const [flags, setFlags] = useState<FlagConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [widgetCode, setWidgetCode] = useState('')
  const [isSavingWidget, setIsSavingWidget] = useState(false)

  const flagIcons: Record<string, { icon: React.ReactNode; title: string }> = {
    canLogin: { icon: <LogIn className="h-6 w-6" />, title: 'User Login' },
    canRegister: { icon: <UserPlus className="h-6 w-6" />, title: 'User Registration' },
    workingInProgress: { icon: <AlertTriangle className="h-6 w-6" />, title: 'Work in Progress' },
    registerFirst: { icon: <UserPlus className="h-6 w-6" />, title: 'Register First' },
    showWidgetChatbot: { icon: <MessageCircle className="h-6 w-6" />, title: 'Show Widget Chatbot' },
  }

  const fetchConfig = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [configResponse, widgetResponse] = await Promise.all([
        api.getAdminConfig(),
        api.getWidgetCode()
      ])
      
      if (configResponse.success && configResponse.data) {
        const flagsWithIcons = configResponse.data.flags.map((flag) => ({
          ...flag,
          icon: flagIcons[flag.key]?.icon || <CheckCircle className="h-6 w-6" />,
          title: flagIcons[flag.key]?.title || flag.key,
        }))
        setFlags(flagsWithIcons)
      } else {
        setError(configResponse.error || 'Failed to fetch configuration')
      }
      
      if (widgetResponse.success && widgetResponse.data) {
        setWidgetCode(widgetResponse.data.code || '')
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleToggle = async (key: string) => {
    setIsSaving(key)
    try {
      const response = await api.toggleFlag(key)
      if (response.success && response.data) {
        setFlags((prev) =>
          prev.map((flag) =>
            flag.key === key ? { ...flag, value: response.data!.value } : flag
          )
        )
      } else {
        setError(response.error || 'Failed to toggle flag')
      }
    } catch (err) {
      setError('Failed to update flag')
      console.error(err)
    } finally {
      setIsSaving(null)
    }
  }

  const handleSaveWidgetCode = async () => {
    setIsSavingWidget(true)
    try {
      const response = await api.saveWidgetCode(widgetCode)
      if (!response.success) {
        setError(response.error || 'Failed to save widget code')
      }
    } catch (err) {
      setError('Failed to save widget code')
      console.error(err)
    } finally {
      setIsSavingWidget(false)
    }
  }

  // Check if showWidgetChatbot flag is enabled
  const isWidgetEnabled = flags.find(f => f.key === 'showWidgetChatbot')?.value ?? false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-500 mt-1">
            Control platform-wide features and access
          </p>
        </div>
        <Button variant="outline" onClick={fetchConfig}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
          <XCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Feature Flags Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {flags.map((flag) => (
          <Card key={flag.key} className={flag.value ? 'border-green-200' : 'border-gray-200'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${flag.value ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {flag.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{flag.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {flag.description || `Toggle ${flag.key}`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {flag.value ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Enabled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400 text-sm font-medium">
                      <XCircle className="h-4 w-4" />
                      Disabled
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={flag.key} className="sr-only">
                    Toggle {flag.title}
                  </Label>
                  {isSaving === flag.key ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Switch
                      id={flag.key}
                      checked={flag.value}
                      onCheckedChange={() => handleToggle(flag.key)}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Widget Chatbot Code - Only show if flag is enabled */}
      {isWidgetEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Widget Chatbot Code
            </CardTitle>
            <CardDescription>
              Paste the widget embed code to display on the login page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={widgetCode}
              onChange={(e) => setWidgetCode(e.target.value)}
              placeholder={`<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    workspaceId: "your-workspace-id",
    title: "Support",
    ...
  };
</script>
<script src="https://your-domain/widget.js" async></script>`}
              rows={10}
              className="font-mono text-sm"
            />
            <Button 
              onClick={handleSaveWidgetCode} 
              disabled={isSavingWidget}
              className="w-full"
            >
              {isSavingWidget ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Widget Code
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">ℹ️ About Platform Flags</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            <strong>User Login:</strong> When disabled, users see a "Coming Soon" popup and cannot login
          </li>
          <li>
            <strong>User Registration:</strong> When disabled, new user registration is blocked
          </li>
          <li>
            <strong>Work in Progress:</strong> Shows a WIP badge on the login page to communicate service status
          </li>
          <li>
            <strong>Register First:</strong> Default view on /auth/login is registration instead of login
          </li>
          <li>
            <strong>Show Widget Chatbot:</strong> When enabled, displays the chatbot widget on the login page
          </li>
        </ul>
      </div>
    </div>
  )
}
