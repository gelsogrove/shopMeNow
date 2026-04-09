/**
 * CalendarSection - Appointment & Calendar Settings
 * 
 * Configures:
 * - Google Calendar connection
 * - Appointment reminder template (with €0.50 pricing info)
 * - Reminder timing (24h, 1h before)
 * - Reminder channel (WhatsApp/Email)
 */

import { useState } from "react"
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
import { Calendar, Bell, DollarSign, Mail, MessageSquare, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CalendarSectionProps {
  formData: {
    enableCalendarBooking?: boolean
    timezone?: string
    appointmentReminderMessage?: string
    appointmentReminderHours?: number[]
    appointmentReminderChannel?: string
  }
  onChange: (field: string, value: any) => void
  onFocus: (field: string) => void
}

export function CalendarSection({ formData, onChange, onFocus }: CalendarSectionProps) {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false) // TODO: Fetch real status from API

  const reminderHours = formData.appointmentReminderHours || [24, 1]
  const has24h = reminderHours.includes(24)
  const has1h = reminderHours.includes(1)
  const has30min = reminderHours.includes(0.5)

  const toggleReminderHour = (hours: number, enabled: boolean) => {
    let newHours = [...reminderHours]
    if (enabled && !newHours.includes(hours)) {
      newHours.push(hours)
    } else if (!enabled) {
      newHours = newHours.filter(h => h !== hours)
    }
    onChange("appointmentReminderHours", newHours.sort((a, b) => b - a))
  }

  const handleGoogleConnect = () => {
    // TODO: Trigger Google OAuth flow
    console.log("Google OAuth flow...")
  }

  return (
    <div className="space-y-6">
      {/* 📅 Enable Calendar Booking */}
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

      {/* 📅 Google Calendar Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Connection
          </CardTitle>
          <CardDescription>
            Connect your Google Calendar to enable appointment booking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isGoogleConnected ? (
            <div className="space-y-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Not connected. Customers can't book appointments yet.
                </AlertDescription>
              </Alert>
              <Button onClick={handleGoogleConnect} className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Connect Google Calendar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Connected</Badge>
                  <span className="text-sm text-muted-foreground">
                    your-email@gmail.com
                  </span>
                </div>
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🔔 Reminder Settings */}
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
              <strong>Pricing:</strong> WhatsApp reminders cost <strong>€0.50</strong> each. Email reminders are <strong>FREE</strong>.
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

          {/* Reminder Timing */}
          <div className="space-y-3">
            <Label>When to Send Reminders</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="reminder-24h" className="font-normal">
                  24 hours before appointment
                </Label>
                <Switch
                  id="reminder-24h"
                  checked={has24h}
                  onCheckedChange={(checked) => toggleReminderHour(24, checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="reminder-1h" className="font-normal">
                  1 hour before appointment
                </Label>
                <Switch
                  id="reminder-1h"
                  checked={has1h}
                  onCheckedChange={(checked) => toggleReminderHour(1, checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="reminder-30min" className="font-normal">
                  30 minutes before appointment
                </Label>
                <Switch
                  id="reminder-30min"
                  checked={has30min}
                  onCheckedChange={(checked) => toggleReminderHour(0.5, checked)}
                />
              </div>
            </div>
          </div>

          {/* Reminder Message Template */}
          <div className="space-y-2">
            <Label htmlFor="reminderMessage">
              Reminder Message Template
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                (applies to all appointment types)
              </span>
            </Label>
            <Textarea
              id="reminderMessage"
              value={formData.appointmentReminderMessage || ""}
              onChange={(e) => {
                onChange("appointmentReminderMessage", e.target.value)
                onFocus("appointmentReminderMessage")
              }}
              placeholder="Ciao {{customerName}}! 📅 Ti ricordiamo..."
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Available variables: <code>{"{{customerName}}"}</code>, <code>{"{{appointmentType}}"}</code>, 
              <code>{"{{appointmentDate}}"}</code>, <code>{"{{appointmentTime}}"}</code>, <code>{"{{workspaceName}}"}</code>
            </p>
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
        </CardContent>
      </Card>
    </div>
  )
}
