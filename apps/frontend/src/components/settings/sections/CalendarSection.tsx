/**
 * CalendarSection - Appointment & Calendar Settings
 *
 * Configures:
 * - Google Calendar connection (real OAuth flow)
 * - Appointment reminder templates (24h, 1h, 30min)
 * - Reminder channel (WhatsApp/Email)
 * - Workspace timezone
 */

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Bell, DollarSign, Mail, MessageSquare, AlertCircle, ExternalLink, Loader2, CheckCircle, Unlink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { calendarConnectionApi, CalendarConnectionStatus } from "@/services/appointmentApi"
import { toast } from "@/lib/toast"

interface CalendarSectionProps {
  workspaceId: string
  formData: {
    enableCalendarBooking?: boolean
    timezone?: string
    appointmentReminder24hEnabled?: boolean
    appointmentReminder24hMessage?: string
    appointmentReminder1hEnabled?: boolean
    appointmentReminder1hMessage?: string
    appointmentReminder30mEnabled?: boolean
    appointmentReminder30mMessage?: string
    appointmentReminderChannel?: string
    minBookingBufferHours?: number
  }
  onChange: (field: string, value: any) => void
  onFocus: (field: string) => void
}

export function CalendarSection({ workspaceId, formData, onChange, onFocus }: CalendarSectionProps) {
  const [connectionStatus, setConnectionStatus] = useState<CalendarConnectionStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [connectingOAuth, setConnectingOAuth] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Load real connection status from API
  useEffect(() => {
    if (!workspaceId) return
    loadConnectionStatus()

    // Handle OAuth redirect back: check URL params for ?connected=true or ?error=
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("connected")
    const error = params.get("error")

    if (connected === "true") {
      toast.success("Google Calendar connected successfully!")
      // Remove query params from URL without page reload
      window.history.replaceState({}, "", window.location.pathname + "?tab=calendar")
    } else if (error) {
      const messages: Record<string, string> = {
        oauth_denied: "Google Calendar authorization was denied",
        token_exchange_failed: "Failed to exchange authorization code",
        missing_params: "Missing OAuth parameters",
        invalid_state: "Invalid OAuth state",
        server_error: "Server error during OAuth flow",
      }
      toast.error(messages[error] || "Failed to connect Google Calendar")
      window.history.replaceState({}, "", window.location.pathname + "?tab=calendar")
    }
  }, [workspaceId])

  const loadConnectionStatus = async () => {
    try {
      setLoadingStatus(true)
      const status = await calendarConnectionApi.getStatus(workspaceId)
      setConnectionStatus(status)
    } catch {
      // Silently fail — connection assumed not set up
      setConnectionStatus({ connected: false, email: null, calendarId: null, lastSyncAt: null, connectedAt: null })
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleGoogleConnect = async () => {
    try {
      setConnectingOAuth(true)
      const { url } = await calendarConnectionApi.getOAuthUrl(workspaceId)

      // Open OAuth in a popup window
      const width = 600
      const height = 700
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      const popup = window.open(
        url,
        "GoogleCalendarOAuth",
        `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      )

      // Listen for postMessage from the OAuth popup callback page
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_CALENDAR_CONNECTED') {
          toast.success("Google Calendar connected successfully!")
          setConnectingOAuth(false)
          loadConnectionStatus()
          window.removeEventListener('message', onMessage)
          clearInterval(pollTimer)
        } else if (event.data?.type === 'GOOGLE_CALENDAR_ERROR') {
          toast.error("Failed to connect Google Calendar")
          setConnectingOAuth(false)
          window.removeEventListener('message', onMessage)
          clearInterval(pollTimer)
        }
      }
      window.addEventListener('message', onMessage)

      // Fallback: poll until popup closes
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer)
          window.removeEventListener('message', onMessage)
          setConnectingOAuth(false)
          loadConnectionStatus()
        }
      }, 500)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to start Google OAuth flow")
      setConnectingOAuth(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      await calendarConnectionApi.disconnect(workspaceId)
      setConnectionStatus({ connected: false, email: null, calendarId: null, lastSyncAt: null, connectedAt: null })
      toast.success("Google Calendar disconnected")
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to disconnect Google Calendar")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleOpenCalendar = () => {
    const width = 1200
    const height = 800
    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2
    window.open(
      "https://calendar.google.com",
      "GoogleCalendar",
      `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    )
  }

  return (
    <div className="space-y-6">
      {/* Enable Calendar Booking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Booking
          </CardTitle>
          <CardDescription>
            Enable or disable appointment booking for this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enableCalendarBooking" className="text-base">
                Enable Appointment Booking
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Allow customers to book appointments via chat
              </p>
            </div>
            <Switch
              id="enableCalendarBooking"
              checked={formData.enableCalendarBooking || false}
              onCheckedChange={(checked) => {
                onChange("enableCalendarBooking", checked)
                onFocus("enableCalendarBooking")
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Connection
          </CardTitle>
          <CardDescription>
            Connect your Google Calendar to sync appointments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking connection status...</span>
            </div>
          ) : !connectionStatus?.connected ? (
            <div className="space-y-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Not connected. Appointments won't sync to Google Calendar.
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleGoogleConnect}
                className="w-full"
                disabled={connectingOAuth}
              >
                {connectingOAuth ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="mr-2 h-4 w-4" />
                )}
                {connectingOAuth ? "Redirecting to Google..." : "Connect Google Calendar"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <Badge variant="success">Connected</Badge>
                  <span className="text-sm text-muted-foreground">
                    {connectionStatus.email}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-3 w-3" />
                  )}
                  Disconnect
                </Button>
              </div>

              {connectionStatus.lastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {new Date(connectionStatus.lastSyncAt).toLocaleString()}
                </p>
              )}

              <Button
                onClick={handleOpenCalendar}
                variant="default"
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Appointment Reminders
          </CardTitle>
          <CardDescription>
            Automatic reminders sent before appointments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pricing Info */}
          <Alert className="border-yellow-200 bg-yellow-50">
            <DollarSign className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Pricing:</strong> Each WhatsApp reminder costs <strong>€0.50</strong>. Email reminders are <strong>FREE</strong>.
              <br />
              <span className="text-xs">If you enable all 3 intervals (24h + 1h + 30min), total cost is <strong>€1.50</strong> per appointment.</span>
            </AlertDescription>
          </Alert>

          {/* Reminder Channel */}
          <div className="space-y-2">
            <Label htmlFor="reminderChannel">Reminder Channel</Label>
            <Select
              value={formData.appointmentReminderChannel || "whatsapp"}
              onValueChange={(value) => {
                onChange("appointmentReminderChannel", value)
                onFocus("appointmentReminderChannel")
              }}
            >
              <SelectTrigger id="reminderChannel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp <Badge variant="outline" className="ml-2">€0.50/reminder</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email <Badge variant="success" className="ml-2">FREE</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="both">
                  <div className="flex items-center gap-2">
                    Both (WhatsApp + Email) <Badge variant="outline" className="ml-2">€0.50/reminder</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 24-Hour Reminder */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="reminder-24h" className="text-base font-semibold">
                  24 hours before
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send reminder 1 day before appointment
                </p>
              </div>
              <Switch
                id="reminder-24h"
                checked={formData.appointmentReminder24hEnabled ?? true}
                onCheckedChange={(checked) => {
                  onChange("appointmentReminder24hEnabled", checked)
                  onFocus("appointmentReminder24hEnabled")
                }}
              />
            </div>

            {formData.appointmentReminder24hEnabled !== false && (
              <div className="mt-3">
                <Label htmlFor="reminder24hMessage" className="text-sm">
                  Message Template (24h)
                </Label>
                <Textarea
                  id="reminder24hMessage"
                  value={formData.appointmentReminder24hMessage || ""}
                  onChange={(e) => {
                    onChange("appointmentReminder24hMessage", e.target.value)
                    onFocus("appointmentReminder24hMessage")
                  }}
                  placeholder="Hello {{customerName}}, reminder: your {{appointmentType}} appointment is tomorrow at {{appointmentTime}}."
                  rows={4}
                  className="font-mono text-sm mt-2"
                />
              </div>
            )}
          </div>

          {/* 1-Hour Reminder */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="reminder-1h" className="text-base font-semibold">
                  1 hour before
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send reminder 60 minutes before appointment
                </p>
              </div>
              <Switch
                id="reminder-1h"
                checked={formData.appointmentReminder1hEnabled ?? true}
                onCheckedChange={(checked) => {
                  onChange("appointmentReminder1hEnabled", checked)
                  onFocus("appointmentReminder1hEnabled")
                }}
              />
            </div>

            {formData.appointmentReminder1hEnabled !== false && (
              <div className="mt-3">
                <Label htmlFor="reminder1hMessage" className="text-sm">
                  Message Template (1h)
                </Label>
                <Textarea
                  id="reminder1hMessage"
                  value={formData.appointmentReminder1hMessage || ""}
                  onChange={(e) => {
                    onChange("appointmentReminder1hMessage", e.target.value)
                    onFocus("appointmentReminder1hMessage")
                  }}
                  placeholder="Hello {{customerName}}, your {{appointmentType}} appointment starts in 1 hour at {{appointmentTime}}."
                  rows={4}
                  className="font-mono text-sm mt-2"
                />
              </div>
            )}
          </div>

          {/* 30-Minute Reminder */}
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="reminder-30m" className="text-base font-semibold">
                  30 minutes before
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send reminder 30 minutes before appointment
                </p>
              </div>
              <Switch
                id="reminder-30m"
                checked={formData.appointmentReminder30mEnabled ?? false}
                onCheckedChange={(checked) => {
                  onChange("appointmentReminder30mEnabled", checked)
                  onFocus("appointmentReminder30mEnabled")
                }}
              />
            </div>

            {formData.appointmentReminder30mEnabled && (
              <div className="mt-3">
                <Label htmlFor="reminder30mMessage" className="text-sm">
                  Message Template (30min)
                </Label>
                <Textarea
                  id="reminder30mMessage"
                  value={formData.appointmentReminder30mMessage || ""}
                  onChange={(e) => {
                    onChange("appointmentReminder30mMessage", e.target.value)
                    onFocus("appointmentReminder30mMessage")
                  }}
                  placeholder="Hello {{customerName}}, your {{appointmentType}} appointment starts in 30 minutes at {{appointmentTime}}."
                  rows={4}
                  className="font-mono text-sm mt-2"
                />
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            <strong>Available variables:</strong> <code>{"{{customerName}}"}</code>, <code>{"{{appointmentType}}"}</code>,{" "}
            <code>{"{{appointmentDate}}"}</code>, <code>{"{{appointmentTime}}"}</code>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Workspace Timezone</Label>
            <Select
              value={formData.timezone || "Europe/Rome"}
              onValueChange={(value) => {
                onChange("timezone", value)
                onFocus("timezone")
              }}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Rome">Europe/Rome (CET/CEST)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
                <SelectItem value="Europe/Madrid">Europe/Madrid (CET/CEST)</SelectItem>
                <SelectItem value="Europe/Lisbon">Europe/Lisbon (WET/WEST)</SelectItem>
                <SelectItem value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</SelectItem>
                <SelectItem value="Europe/Brussels">Europe/Brussels (CET/CEST)</SelectItem>
                <SelectItem value="Europe/Zurich">Europe/Zurich (CET/CEST)</SelectItem>
                <SelectItem value="Europe/Vienna">Europe/Vienna (CET/CEST)</SelectItem>
                <SelectItem value="Europe/Athens">Europe/Athens (EET/EEST)</SelectItem>
                <SelectItem value="Europe/Istanbul">Europe/Istanbul (TRT)</SelectItem>
                <SelectItem value="Europe/Moscow">Europe/Moscow (MSK)</SelectItem>
                <SelectItem value="America/New_York">America/New York (EST/EDT)</SelectItem>
                <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                <SelectItem value="America/Los_Angeles">America/Los Angeles (PST/PDT)</SelectItem>
                <SelectItem value="America/Sao_Paulo">America/São Paulo (BRT)</SelectItem>
                <SelectItem value="America/Argentina/Buenos_Aires">America/Buenos Aires (ART)</SelectItem>
                <SelectItem value="America/Mexico_City">America/Mexico City (CST/CDT)</SelectItem>
                <SelectItem value="America/Bogota">America/Bogotá (COT)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</SelectItem>
                <SelectItem value="Africa/Cairo">Africa/Cairo (EET)</SelectItem>
                <SelectItem value="Africa/Johannesburg">Africa/Johannesburg (SAST)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Timezone used for appointment scheduling and reminders
            </p>
          </div>

          {/* Minimum Booking Buffer */}
          <div className="space-y-2">
            <Label htmlFor="minBookingBufferHours">Minimum Booking Buffer (hours)</Label>
            <Select
              value={String(formData.minBookingBufferHours ?? 12)}
              onValueChange={(value) => {
                onChange("minBookingBufferHours", parseInt(value, 10))
                onFocus("minBookingBufferHours")
              }}
            >
              <SelectTrigger id="minBookingBufferHours">
                <SelectValue placeholder="Select minimum hours" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="12">12 hours (default)</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="48">48 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Customers can only book slots at least this many hours in advance
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
