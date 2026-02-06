/**
 * Widget Settings Page - Backoffice
 * 
 * Allows workspace admins to:
 * - View and copy embed code snippet
 * - Download embed code as file
 * - Configure widget appearance
 * - View usage statistics
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Copy,
  Download,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Code2,
  Settings,
  BarChart3,
  Loader2,
  RefreshCw,
  MessageSquare,
  HeadphonesIcon
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { workspaceApi } from '@/services/workspaceApi'

interface EmbedCodeResponse {
  success: boolean
  embedCode: string
  workspaceId: string
  message: string
}

interface WidgetStats {
  messagesPerDay: number
  visitorsPerDay: number
  conversionsPerDay: number
  averageRating: number
}

export function WidgetSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { user } = useAuth()

  const [embedCode, setEmbedCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [stats, setStats] = useState<WidgetStats | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  
  // WhatsApp Provider Configuration
  const [whatsappProvider, setWhatsappProvider] = useState<'meta' | 'ultramsg'>('meta')
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('')
  const [metaAccessToken, setMetaAccessToken] = useState('')
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('')
  const [ultraMsgInstanceId, setUltraMsgInstanceId] = useState('')
  const [ultraMsgToken, setUltraMsgToken] = useState('')
  const [savingWhatsApp, setSavingWhatsApp] = useState(false)
  
  // Support Settings
  const [hasHumanSupport, setHasHumanSupport] = useState(false)
  const [frustrationEscalationInstructions, setFrustrationEscalationInstructions] = useState('')
  const [operatorContactMethod, setOperatorContactMethod] = useState<'email' | 'whatsapp'>('email')
  const [operatorEmail, setOperatorEmail] = useState('')
  const [operatorWhatsappNumber, setOperatorWhatsappNumber] = useState('')
  const [savingSupport, setSavingSupport] = useState(false)

  // Fetch embed code on mount
  useEffect(() => {
    fetchEmbedCode()
    fetchWhatsAppConfig()
    fetchSupportSettings()
  }, [workspaceId])

  async function fetchEmbedCode() {
    if (!workspaceId) return

    try {
      setLoading(true)
      setError('')

      const response = await api.get(
        `/workspaces/${workspaceId}/widget/embed-code`
      )

      if (response.data?.success) {
        setEmbedCode(response.data.embedCode)
      } else {
        setError('Failed to load embed code')
      }
    } catch (err) {
      console.error('Error fetching embed code:', err)
      setError('Failed to load widget settings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchWhatsAppConfig() {
    if (!workspaceId) return

    try {
      const response = await workspaceApi.getWhatsAppConfig(workspaceId)
      
      if (response.success && response.data) {
        setWhatsappProvider(response.data.whatsappProvider || 'meta')
        setMetaPhoneNumberId(response.data.metaPhoneNumberId || '')
        setMetaAccessToken(response.data.metaAccessToken || '')
        setWebhookVerifyToken(response.data.webhookVerifyToken || '')
        setUltraMsgInstanceId(response.data.ultraMsgInstanceId || '')
        setUltraMsgToken(response.data.ultraMsgToken || '')
      }
    } catch (err) {
      console.error('Error fetching WhatsApp config:', err)
      // Don't show error toast - just use defaults
    }
  }

  async function fetchSupportSettings() {
    if (!workspaceId) return

    try {
      const workspace = await workspaceApi.getWorkspace(workspaceId)
      
      setHasHumanSupport(workspace.hasHumanSupport ?? false)
      setFrustrationEscalationInstructions(workspace.frustrationEscalationInstructions || '')
      setOperatorContactMethod((workspace.operatorContactMethod as 'email' | 'whatsapp') || 'email')
      setOperatorEmail(workspace.operatorEmail || '')
      setOperatorWhatsappNumber(workspace.operatorWhatsappNumber || '')
    } catch (err) {
      console.error('Error fetching support settings:', err)
      // Don't show error toast - just use defaults
    }
  }

  async function saveWhatsAppConfig() {
    if (!workspaceId) return

    try {
      setSavingWhatsApp(true)
      
      const config = {
        whatsappProvider,
        metaPhoneNumberId: whatsappProvider === 'meta' ? metaPhoneNumberId : undefined,
        metaAccessToken: whatsappProvider === 'meta' ? metaAccessToken : undefined,
        webhookVerifyToken: whatsappProvider === 'meta' ? webhookVerifyToken : undefined,
        ultraMsgInstanceId: whatsappProvider === 'ultramsg' ? ultraMsgInstanceId : undefined,
        ultraMsgToken: whatsappProvider === 'ultramsg' ? ultraMsgToken : undefined,
      }

      const response = await workspaceApi.updateWhatsAppConfig(workspaceId, config)

      if (response.success) {
        toast.success('WhatsApp configuration saved successfully!')
      } else {
        toast.error(response.message || 'Failed to save configuration')
      }
    } catch (err) {
      console.error('Error saving WhatsApp config:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSavingWhatsApp(false)
    }
  }

  async function saveSupportSettings() {
    if (!workspaceId) return

    try {
      setSavingSupport(true)
      
      const updateData = {
        hasHumanSupport,
        frustrationEscalationInstructions,
        operatorContactMethod,
        operatorEmail,
        operatorWhatsappNumber,
      }

      await workspaceApi.updateWorkspace(workspaceId, updateData)
      toast.success('Support settings saved successfully!')
    } catch (err) {
      console.error('Error saving support settings:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save support settings')
    } finally {
      setSavingSupport(false)
    }
  }

  async function copyToClipboard() {
    if (!embedCode) return

    try {
      setCopying(true)
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast.success('Embed code copied to clipboard!')

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Failed to copy to clipboard')
    } finally {
      setCopying(false)
    }
  }

  async function downloadEmbedCode() {
    if (!embedCode || !workspaceId) return

    try {
      setDownloading(true)
      const element = document.createElement('a')
      const file = new Blob([embedCode], { type: 'text/plain' })
      element.href = URL.createObjectURL(file)
      element.download = `echatbot-widget-${workspaceId}.js`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
      toast.success('Embed code downloaded!')
    } catch (err) {
      console.error('Failed to download:', err)
      toast.error('Failed to download embed code')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Widget Settings
        </h1>
        <p className="text-gray-600 mt-2">
          Manage your embeddable chat widget for external websites
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="embed" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="embed" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            <span className="hidden sm:inline">Embed Code</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-2">
            <HeadphonesIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Support</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
        </TabsList>

        {/* Embed Code Tab */}
        <TabsContent value="embed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>
                Copy this code and paste it into your website's HTML
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {/* Code Display */}
                  <div className="bg-slate-900 rounded-lg p-4 text-white font-mono text-sm overflow-auto max-h-64">
                    <ScrollArea className="w-full">
                      <pre className="whitespace-pre-wrap break-words pr-4">
                        {embedCode}
                      </pre>
                    </ScrollArea>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      onClick={copyToClipboard}
                      disabled={copying}
                      variant="default"
                      className="flex items-center gap-2"
                    >
                      {copying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : copied ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </Button>

                    <Button
                      onClick={downloadEmbedCode}
                      disabled={downloading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download as File
                    </Button>

                    <Button
                      onClick={fetchEmbedCode}
                      variant="outline"
                      size="icon"
                      title="Refresh embed code"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Instructions */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>How to use</AlertTitle>
                    <AlertDescription>
                      <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
                        <li>Copy the code above</li>
                        <li>Paste it into your website's HTML (inside &lt;head&gt; or before &lt;/body&gt;)</li>
                        <li>Save and refresh your website</li>
                        <li>The chat widget should appear in the bottom-right corner</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Widget Configuration</CardTitle>
              <CardDescription>
                Coming soon: Configure widget appearance and behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Widget Title
                  </label>
                  <Input
                    defaultValue="Chat with us 💬"
                    disabled
                    className="opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Coming soon: Customize widget title
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Placeholder Text
                  </label>
                  <Input
                    defaultValue="Type a message..."
                    disabled
                    className="opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Coming soon: Customize input placeholder
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Widget Position
                  </label>
                  <select
                    defaultValue="bottom-right"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg opacity-50"
                  >
                    <option>bottom-right</option>
                    <option>bottom-left</option>
                    <option>top-right</option>
                    <option>top-left</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Coming soon: Choose widget position
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Human Support & Escalation</CardTitle>
              <CardDescription>
                Configure when and how the chatbot should escalate conversations to a human operator
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Human Support Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Enable Human Support</Label>
                  <p className="text-sm text-gray-600">
                    Allow chatbot to escalate to human operator when needed
                  </p>
                </div>
                <button
                  onClick={() => setHasHumanSupport(!hasHumanSupport)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hasHumanSupport ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      hasHumanSupport ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {hasHumanSupport && (
                <>
                  {/* Notification Method Selector */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Notification Method</Label>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setOperatorContactMethod('email')}
                        className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                          operatorContactMethod === 'email'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">📧 Email</div>
                          <div className="text-sm text-gray-600 mt-1">Send notification to operator email</div>
                        </div>
                      </button>
                      <button
                        onClick={() => setOperatorContactMethod('whatsapp')}
                        className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                          operatorContactMethod === 'whatsapp'
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-left">
                          <div className="font-semibold text-gray-900">📱 WhatsApp</div>
                          <div className="text-sm text-gray-600 mt-1">Send notification to operator WhatsApp</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Operator Email (shown when email method selected) */}
                  {operatorContactMethod === 'email' && (
                    <div className="space-y-2 p-4 border rounded-lg bg-blue-50/50">
                      <Label htmlFor="operatorEmail">Operator Email Address</Label>
                      <Input
                        id="operatorEmail"
                        type="email"
                        placeholder="support@example.com"
                        value={operatorEmail}
                        onChange={(e) => setOperatorEmail(e.target.value)}
                        className="bg-white"
                      />
                      <p className="text-xs text-gray-600">
                        Email address to notify when escalation happens
                      </p>
                    </div>
                  )}

                  {/* Operator WhatsApp Number (shown when whatsapp method selected) */}
                  {operatorContactMethod === 'whatsapp' && (
                    <div className="space-y-2 p-4 border rounded-lg bg-green-50/50">
                      <Label htmlFor="operatorWhatsapp">Operator WhatsApp Number</Label>
                      <Input
                        id="operatorWhatsapp"
                        type="text"
                        placeholder="+34654728753"
                        value={operatorWhatsappNumber}
                        onChange={(e) => setOperatorWhatsappNumber(e.target.value)}
                        className="bg-white"
                      />
                      <p className="text-xs text-gray-600">
                        WhatsApp number to notify when escalation happens (include country code, e.g., +34654728753)
                      </p>
                    </div>
                  )}

                  {/* Escalation Instructions */}
                  <div className="space-y-2">
                    <Label htmlFor="escalationInstructions">When to Escalate to Human</Label>
                    <Textarea
                      id="escalationInstructions"
                      placeholder="Example:\n- when customer asks to speak with operator\n- when customer expresses frustration\n- when customer says 'nothing works'\n- when customer is angry or upset"
                      value={frustrationEscalationInstructions}
                      onChange={(e) => setFrustrationEscalationInstructions(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-600">
                      List the situations when the chatbot should call contactOperator() and escalate to a human. One trigger per line.
                    </p>
                  </div>

                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm">
                      <strong>How it works:</strong> When any of these triggers are detected, the chatbot will automatically:
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Call the contactOperator() function</li>
                        <li>Disable the chatbot for this customer</li>
                        <li>Replace {{'{'}nameUser{'}'}} with customer name in response</li>
                        <li>Send {operatorContactMethod === 'email' ? 'email' : 'WhatsApp'} notification to operator ({operatorContactMethod === 'email' ? operatorEmail || 'not set' : operatorWhatsappNumber || 'not set'})</li>
                        <li>Create a support ticket with conversation summary</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={saveSupportSettings}
                  disabled={savingSupport}
                  className="flex items-center gap-2"
                >
                  {savingSupport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Save Support Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Configuration Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Provider Configuration</CardTitle>
              <CardDescription>
                Configure your WhatsApp messaging provider (Meta Business API or UltraMsg)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selector */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Provider</Label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setWhatsappProvider('meta')}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      whatsappProvider === 'meta'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">Meta Business API</div>
                      <div className="text-sm text-gray-600 mt-1">Official WhatsApp Business Platform</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setWhatsappProvider('ultramsg')}
                    className={`flex-1 p-4 border-2 rounded-lg transition-all ${
                      whatsappProvider === 'ultramsg'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">UltraMsg</div>
                      <div className="text-sm text-gray-600 mt-1">Simple WhatsApp API (no Meta verification)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Meta Configuration Form */}
              {whatsappProvider === 'meta' && (
                <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
                  <h3 className="font-semibold text-gray-900">Meta Business API Settings</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="metaPhoneNumberId">Phone Number ID</Label>
                    <Input
                      id="metaPhoneNumberId"
                      type="text"
                      placeholder="1234567890"
                      value={metaPhoneNumberId}
                      onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                      className="bg-white"
                    />
                    <p className="text-xs text-gray-600">
                      Found in Meta Business Manager → WhatsApp → API Setup
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metaAccessToken">Access Token</Label>
                    <Input
                      id="metaAccessToken"
                      type="password"
                      placeholder="EAAxxxxxxxx..."
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      className="bg-white"
                    />
                    <p className="text-xs text-gray-600">
                      Permanent access token from Meta Business Manager
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
                    <Input
                      id="webhookVerifyToken"
                      type="text"
                      placeholder="my-verify-token"
                      value={webhookVerifyToken}
                      onChange={(e) => setWebhookVerifyToken(e.target.value)}
                      className="bg-white"
                    />
                    <p className="text-xs text-gray-600">
                      Custom token for webhook verification (set in Meta webhook config)
                    </p>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Webhook URL:</strong>{' '}
                      <code className="bg-white px-2 py-1 rounded">
                        https://www.echatbot.ai/api/v1/whatsapp/webhook/{workspaceId || '{workspaceId}'}
                      </code>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* UltraMsg Configuration Form */}
              {whatsappProvider === 'ultramsg' && (
                <div className="space-y-4 p-4 border rounded-lg bg-green-50/50">
                  <h3 className="font-semibold text-gray-900">UltraMsg API Settings</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ultraMsgInstanceId">Instance ID</Label>
                    <Input
                      id="ultraMsgInstanceId"
                      type="text"
                      placeholder="instance12345"
                      value={ultraMsgInstanceId}
                      onChange={(e) => setUltraMsgInstanceId(e.target.value)}
                      className="bg-white"
                    />
                    <p className="text-xs text-gray-600">
                      Your UltraMsg instance ID from dashboard
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ultraMsgToken">API Token</Label>
                    <Input
                      id="ultraMsgToken"
                      type="password"
                      placeholder="xxxxxxxxxxxxxxxx"
                      value={ultraMsgToken}
                      onChange={(e) => setUltraMsgToken(e.target.value)}
                      className="bg-white"
                    />
                    <p className="text-xs text-gray-600">
                      API token from UltraMsg dashboard
                    </p>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Webhook URL:</strong>{' '}
                      <code className="bg-white px-2 py-1 rounded">
                        https://www.echatbot.ai/api/v1/whatsapp/ultramsg/{workspaceId || '{workspaceId}'}
                      </code>
                      <br />
                      <span className="mt-2 block">
                        Configure this URL in your UltraMsg dashboard under Webhooks
                      </span>
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-xs text-green-800">
                      <strong>✨ No Meta Verification Required!</strong> UltraMsg works with regular WhatsApp numbers without business verification.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={saveWhatsAppConfig}
                  disabled={savingWhatsApp}
                  className="flex items-center gap-2"
                >
                  {savingWhatsApp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Widget Statistics</CardTitle>
              <CardDescription>
                Track widget usage and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-slate-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">-</p>
                      <p className="text-sm text-gray-600 mt-2">Messages Today</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">-</p>
                      <p className="text-sm text-gray-600 mt-2">Visitors Today</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">-</p>
                      <p className="text-sm text-gray-600 mt-2">Conversions Today</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">-</p>
                      <p className="text-sm text-gray-600 mt-2">Average Rating</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Alert className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Coming Soon</AlertTitle>
                <AlertDescription>
                  Statistics tracking is coming in the next release
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default WidgetSettingsPage
