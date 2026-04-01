/**
 * EnvironmentVariablesSection - Secure credential management for calling functions
 *
 * Features:
 * - ✅ Create, read, update, delete encrypted credentials
 * - ✅ Never display decrypted values in the frontend
 * - ✅ Support for multiple credential locations (header, querystring, body)
 * - ✅ Built-in instructions for using credentials in calling functions
 * - ✅ Security best practices and examples
 *
 * Credentials are:
 * - 🔐 Encrypted at rest with AES-256-GCM
 * - 📝 Namespaced by workspace (workspace isolation)
 * - 🔑 Injected automatically at webhook dispatch time
 * - 🚫 Never logged or exposed in responses
 */

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Plus,
    Trash2,
    Edit2,
    Loader2,
    Lock,
    Eye,
    Copy,
    AlertCircle,
} from "lucide-react"
import { toast } from "@/lib/toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { api } from "@/services/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EnvironmentVariable {
    id: string
    variableName: string
    description: string | null
    createdAt: string
    updatedAt: string
}

interface EnvironmentVariablesSectionProps {
    workspaceId: string
    canEdit: boolean
}

export function EnvironmentVariablesSection({
    workspaceId,
    canEdit,
}: EnvironmentVariablesSectionProps) {
    const [variables, setVariables] = useState<EnvironmentVariable[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingVariable, setEditingVariable] = useState<{
        variableName: string
        plaintext: string
        description: string
    } | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; name: string | null }>({ open: false, name: null })

    useEffect(() => {
        if (workspaceId) {
            loadVariables()
        }
    }, [workspaceId])

    const loadVariables = async () => {
        try {
            setLoading(true)
            const response = await api.get(`/api/workspaces/${workspaceId}/env-vars`)
            setVariables(response.data.data || [])
        } catch (error) {
            console.error("Failed to load environment variables:", error)
            toast.error("Failed to load environment variables")
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!editingVariable?.variableName) {
            toast.error("Variable name is required")
            return
        }

        if (!editingVariable?.plaintext) {
            toast.error("Credential value is required")
            return
        }

        // Validate variable name format: UPPERCASE_WITH_UNDERSCORES
        const nameRegex = /^[A-Z_][A-Z0-9_]*$/
        if (!nameRegex.test(editingVariable.variableName)) {
            toast.error(
                "Variable name must be uppercase with underscores only (e.g., STRIPE_API_KEY)"
            )
            return
        }

        try {
            setIsSaving(true)

            if (editingVariable.variableName in Object.fromEntries(variables.map(v => [v.variableName, true]))) {
                // Update existing
                await api.patch(
                    `/api/workspaces/${workspaceId}/env-vars/${editingVariable.variableName}`,
                    {
                        plaintext: editingVariable.plaintext,
                        description: editingVariable.description || undefined,
                    }
                )
                toast.success("Credential updated successfully")
            } else {
                // Create new
                await api.post(
                    `/api/workspaces/${workspaceId}/env-vars`,
                    {
                        variableName: editingVariable.variableName,
                        plaintext: editingVariable.plaintext,
                        description: editingVariable.description || undefined,
                    }
                )
                toast.success("Credential created successfully")
            }

            setIsModalOpen(false)
            setEditingVariable(null)
            await loadVariables()
        } catch (error: any) {
            console.error("Failed to save environment variable:", error)
            const message = error.response?.data?.message || "Failed to save credential"
            toast.error(message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirm.name) return

        try {
            await api.delete(`/api/workspaces/${workspaceId}/env-vars/${deleteConfirm.name}`)
            toast.success("Credential deleted successfully")
            setDeleteConfirm({ open: false, name: null })
            await loadVariables()
        } catch (error: any) {
            console.error("Failed to delete environment variable:", error)
            toast.error("Failed to delete credential")
        }
    }

    const openAddModal = () => {
        setEditingVariable({
            variableName: "",
            plaintext: "",
            description: "",
        })
        setIsModalOpen(true)
    }

    const openEditModal = (variable: EnvironmentVariable) => {
        setEditingVariable({
            variableName: variable.variableName,
            plaintext: "",
            description: variable.description || "",
        })
        setIsModalOpen(true)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Main Content */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-blue-600" />
                        <div>
                            <CardTitle>Environment Variables</CardTitle>
                            <CardDescription>
                                Secure credentials for API integrations (Stripe, Mailchimp, etc.)
                            </CardDescription>
                        </div>
                    </div>
                    {canEdit && (
                        <Button
                            onClick={openAddModal}
                            size="sm"
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add Credential
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Security Notice */}
                    <div className="flex gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">🔐 Security</p>
                            <p>
                                Values are encrypted with AES-256-GCM and never logged. Once created, values cannot be retrieved - only updated or deleted.
                            </p>
                        </div>
                    </div>

                    {/* Credentials List */}
                    {variables.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No credentials configured yet</p>
                            {canEdit && (
                                <Button
                                    onClick={openAddModal}
                                    variant="outline"
                                    size="sm"
                                    className="mt-4 gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Create First Credential
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {variables.map((variable) => (
                                <div
                                    key={variable.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-mono font-semibold text-sm text-gray-900">
                                            {variable.variableName}
                                        </p>
                                        {variable.description && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                {variable.description}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1">
                                            Updated {new Date(variable.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                            <Button
                                                onClick={() => openEditModal(variable)}
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                onClick={() => setDeleteConfirm({ open: true, name: variable.variableName })}
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Instructions Panel - Complete Setup Guide */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-blue-600" />
                        Secure Credentials Guide
                    </CardTitle>
                    <CardDescription>
                        Complete setup instructions for integrating API keys with your custom tools
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <Tabs defaultValue="quickstart" className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="quickstart">Start</TabsTrigger>
                            <TabsTrigger value="location">Locations</TabsTrigger>
                            <TabsTrigger value="examples">Examples</TabsTrigger>
                            <TabsTrigger value="apis">Popular APIs</TabsTrigger>
                            <TabsTrigger value="security">Security</TabsTrigger>
                        </TabsList>

                        {/* TAB: QUICKSTART */}
                        <TabsContent value="quickstart" className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="font-semibold text-gray-900 mb-3">🚀 Quick Start (3 Steps)</h3>
                                
                                <div className="space-y-4">
                                    <div className="border-l-4 border-blue-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">Step 1: Create Credential</p>
                                        <p className="text-gray-700 text-sm mb-2">
                                            Click "Add Credential" above and fill in:
                                        </p>
                                        <ul className="text-sm text-gray-600 space-y-1">
                                            <li>• <strong>Variable Name:</strong> <span className="font-mono">STRIPE_API_KEY</span></li>
                                            <li>• <strong>Value:</strong> <span className="font-mono">sk_live_abc123...</span></li>
                                            <li>• <strong>Description:</strong> "Stripe production key for payments" (optional)</li>
                                        </ul>
                                    </div>

                                    <div className="border-l-4 border-indigo-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">Step 2: Add credentialsMapping to Custom Tool</p>
                                        <p className="text-gray-700 text-sm mb-2">
                                            In your Calling Function settings, add this field:
                                        </p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"credentialsMapping": {
  "stripe_auth": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "STRIPE_API_KEY"
  }
}`}</pre>
                                    </div>

                                    <div className="border-l-4 border-purple-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">Step 3: Done! Automatic Injection</p>
                                        <p className="text-gray-700 text-sm">
                                            When your webhook is triggered, we automatically:
                                        </p>
                                        <ul className="text-sm text-gray-600 space-y-1 mt-2">
                                            <li>✅ Decrypt <span className="font-mono">STRIPE_API_KEY</span></li>
                                            <li>✅ Inject into <span className="font-mono">Authorization: Bearer sk_live_abc123...</span></li>
                                            <li>✅ Call your webhook</li>
                                            <li>✅ Never log or expose the credential</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-900">
                                <p className="font-semibold mb-1">💡 Key Principle</p>
                                <p>
                                    Credentials are <strong>never stored in your calling function</strong>. Instead, you reference them by name, and we inject them at runtime.
                                </p>
                            </div>
                        </TabsContent>

                        {/* TAB: LOCATIONS */}
                        <TabsContent value="location" className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="font-semibold text-gray-900 mb-4">📍 Injection Locations</h3>

                                <div className="space-y-4">
                                    {/* HEADER */}
                                    <div className="border-t pt-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">1</span>
                                            <h4 className="font-semibold text-gray-900">HTTP Header</h4>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Inject credential as an HTTP header (most common for APIs)
                                        </p>
                                        <div className="bg-gray-50 p-3 rounded mb-2 font-mono text-xs">
                                            <p className="text-gray-700">Location: <span className="text-blue-600">header</span></p>
                                            <p className="text-gray-700">Format: <span className="font-semibold">"Bearer \${value}" (optional)</span></p>
                                        </div>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`{
  "api_auth": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "API_TOKEN"
  }
}`}</pre>
                                        <p className="text-xs text-gray-600 mt-2">
                                            Becomes: <span className="font-mono bg-gray-100 px-2 py-1 rounded">Authorization: Bearer eyJhbGc...</span>
                                        </p>
                                    </div>

                                    {/* QUERYSTRING */}
                                    <div className="border-t pt-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-sm font-semibold">2</span>
                                            <h4 className="font-semibold text-gray-900">URL Parameter (Querystring)</h4>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Append credential to the webhook URL as a query parameter
                                        </p>
                                        <div className="bg-gray-50 p-3 rounded mb-2 font-mono text-xs">
                                            <p className="text-gray-700">Location: <span className="text-green-600">querystring</span></p>
                                            <p className="text-gray-700">Automatically URL-encoded (no need to escape)</p>
                                        </div>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`{
  "api_key": {
    "location": "querystring",
    "paramName": "api_key",
    "variableName": "SENDGRID_API_KEY"
  }
}`}</pre>
                                        <p className="text-xs text-gray-600 mt-2">
                                            Becomes: <span className="font-mono bg-gray-100 px-2 py-1 rounded">https://webhook.com?api_key=SG.abc123</span>
                                        </p>
                                    </div>

                                    {/* BODY */}
                                    <div className="border-t pt-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-sm font-semibold">3</span>
                                            <h4 className="font-semibold text-gray-900">Request Body (JSON)</h4>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Inject credential into the JSON request body (supports nested fields via dot notation)
                                        </p>
                                        <div className="bg-gray-50 p-3 rounded mb-2 font-mono text-xs">
                                            <p className="text-gray-700">Location: <span className="text-purple-600">body</span></p>
                                            <p className="text-gray-700">ParamName: Use dots for nesting: <span className="font-semibold">"config.stripe_key"</span></p>
                                        </div>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`{
  "stripe_auth": {
    "location": "body",
    "paramName": "config.credentials.stripe_key",
    "variableName": "STRIPE_API_KEY"
  }
}`}</pre>
                                        <p className="text-xs text-gray-600 mt-2">
                                            Body becomes: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{"{ config: { credentials: { stripe_key: \"sk_live...\" } } }"}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: EXAMPLES */}
                        <TabsContent value="examples" className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="font-semibold text-gray-900 mb-4">💼 Real-World Examples</h3>

                                <div className="space-y-4">
                                    {/* Multi-location */}
                                    <div className="border-l-4 border-orange-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-2">Mixing Locations in One Call</p>
                                        <p className="text-gray-700 text-sm mb-2">
                                            Use multiple credentials at different locations:
                                        </p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"credentialsMapping": {
  "stripe_auth": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "STRIPE_API_KEY"
  },
  "user_id": {
    "location": "querystring",
    "paramName": "uid",
    "variableName": "USER_ID"
  },
  "webhook_secret": {
    "location": "body",
    "paramName": "security.secret",
    "variableName": "WEBHOOK_SECRET"
  }
}`}</pre>
                                        <p className="text-xs text-gray-600 mt-2">
                                            Result: All three credentials injected at once!
                                        </p>
                                    </div>

                                    {/* Nested paths */}
                                    <div className="border-l-4 border-cyan-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-2">Deep Nesting (3+ levels)</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"paramName": "auth.providers.stripe.production_key"

Result in JSON:
{
  "auth": {
    "providers": {
      "stripe": {
        "production_key": "sk_live_..."
      }
    }
  }
}`}</pre>
                                    </div>

                                    {/* Format templates */}
                                    <div className="border-l-4 border-pink-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-2">Format Templates</p>
                                        <p className="text-gray-700 text-sm mb-2">
                                            Use <span className="font-mono">format</span> to wrap the value:
                                        </p>
                                        <div className="space-y-2 text-sm">
                                            <div className="bg-gray-50 p-2 rounded font-mono text-xs">
                                                <p><span className="text-pink-600">"Bearer \${value}"</span> → <span className="text-gray-600">Bearer sk_live_...</span></p>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded font-mono text-xs">
                                                <p><span className="text-pink-600">"Basic \${value}"</span> → <span className="text-gray-600">Basic dXNlcjo...</span></p>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded font-mono text-xs">
                                                <p><span className="text-pink-600">"\${value}"</span> → <span className="text-gray-600">plain value</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: POPULAR APIs */}
                        <TabsContent value="apis" className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="font-semibold text-gray-900 mb-4">🔗 Popular APIs Setup</h3>

                                <div className="space-y-4">
                                    {/* STRIPE */}
                                    <div className="border-b pb-4">
                                        <p className="font-semibold text-gray-900 mb-2">Stripe</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"credentialsMapping": {
  "stripe_api": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "STRIPE_API_KEY"
  }
}

Variable Name: STRIPE_API_KEY
Value: sk_live_...`}</pre>
                                    </div>

                                    {/* MAILCHIMP */}
                                    <div className="border-b pb-4">
                                        <p className="font-semibold text-gray-900 mb-2">Mailchimp</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"credentialsMapping": {
  "mailchimp_auth": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "MAILCHIMP_API_KEY"
  }
}

Variable Name: MAILCHIMP_API_KEY
Value: abc123def456...`}</pre>
                                    </div>

                                    {/* TWILIO */}
                                    <div className="border-b pb-4">
                                        <p className="font-semibold text-gray-900 mb-2">Twilio</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"credentialsMapping": {
  "twilio_auth": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Basic \${value}",
    "variableName": "TWILIO_AUTH_TOKEN"
  }
}

Variable Name: TWILIO_AUTH_TOKEN
Value: dGhlIGF1dGggdG9rZW4gYmFzZTY0...`}</pre>
                                    </div>

                                    {/* SENDGRID */}
                                    <div className="border-b pb-4">
                                        <p className="font-semibold text-gray-900 mb-2">SendGrid</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"credentialsMapping": {
  "sendgrid_api": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "SENDGRID_API_KEY"
  }
}

Variable Name: SENDGRID_API_KEY
Value: SG.abc123...`}</pre>
                                    </div>

                                    {/* GENERIC REST API */}
                                    <div>
                                        <p className="font-semibold text-gray-900 mb-2">Generic REST API</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`"credentialsMapping": {
  "api_key": {
    "location": "body",
    "paramName": "auth.api_key",
    "variableName": "CUSTOM_API_KEY"
  },
  "webhook_id": {
    "location": "querystring",
    "paramName": "webhook_id",
    "variableName": "WEBHOOK_ID"
  }
}

Variables:
- CUSTOM_API_KEY: your_api_key_here
- WEBHOOK_ID: webhook_123`}</pre>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: SECURITY */}
                        <TabsContent value="security" className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="font-semibold text-gray-900 mb-4">🔐 Security Features</h3>

                                <div className="space-y-4">
                                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                                        <p className="font-semibold text-green-900 text-sm mb-1">✅ Encryption at Rest</p>
                                        <p className="text-green-800 text-sm">
                                            All credentials are encrypted with <strong>AES-256-GCM</strong> before storage. Only your workspace can decrypt them.
                                        </p>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                        <p className="font-semibold text-blue-900 text-sm mb-1">✅ Runtime Decryption Only</p>
                                        <p className="text-blue-800 text-sm">
                                            Credentials are decrypted <strong>only when needed</strong> for webhook dispatch, then discarded immediately.
                                        </p>
                                    </div>

                                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                        <p className="font-semibold text-purple-900 text-sm mb-1">✅ Never Logged</p>
                                        <p className="text-purple-800 text-sm">
                                            Plaintext values <strong>never appear in logs</strong>. Only names and operations are recorded.
                                        </p>
                                    </div>

                                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                                        <p className="font-semibold text-indigo-900 text-sm mb-1">✅ Workspace Isolation</p>
                                        <p className="text-indigo-800 text-sm">
                                            Each workspace has its own encryption key. One workspace <strong>cannot access another's credentials</strong>.
                                        </p>
                                    </div>

                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                                        <p className="font-semibold text-amber-900 text-sm mb-1">⚠️ No Retrieval After Creation</p>
                                        <p className="text-amber-800 text-sm">
                                            Once created, plaintext is never returned to you. You can only <strong>update</strong> (rotate) or <strong>delete</strong> credentials.
                                        </p>
                                    </div>

                                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                                        <p className="font-semibold text-red-900 text-sm mb-1">🗑️ Complete Deletion</p>
                                        <p className="text-red-800 text-sm">
                                            When deleted, credentials are <strong>permanently removed</strong>. No backups of plaintext values are kept.
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 border border-gray-300 p-3 rounded-lg mt-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-2">Best Practices:</p>
                                        <ul className="text-gray-800 text-sm space-y-1">
                                            <li>✓ Use strong, unique credentials for each API</li>
                                            <li>✓ Rotate credentials periodically (delete old, create new)</li>
                                            <li>✓ Add descriptive names to track which credential is which</li>
                                            <li>✓ Only create credentials for APIs you actually use</li>
                                            <li>✓ Delete credentials when an API integration is removed</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingVariable?.variableName && variables.some(v => v.variableName === editingVariable.variableName)
                                ? "Update Credential"
                                : "Create Credential"}
                        </DialogTitle>
                        <DialogDescription>
                            Store API keys and secrets securely for webhook credentials
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Variable Name */}
                        <div className="space-y-2">
                            <Label htmlFor="variableName">Variable Name</Label>
                            <Input
                                id="variableName"
                                placeholder="e.g., STRIPE_API_KEY"
                                value={editingVariable?.variableName || ""}
                                onChange={(e) =>
                                    setEditingVariable(prev => prev ? { ...prev, variableName: e.target.value.toUpperCase() } : null)
                                }
                                disabled={editingVariable?.variableName ? variables.some(v => v.variableName === editingVariable.variableName) : false}
                                className="font-mono"
                            />
                            <p className="text-xs text-gray-500">
                                Uppercase letters, numbers, and underscores only
                            </p>
                        </div>

                        {/* Credential Value */}
                        <div className="space-y-2">
                            <Label htmlFor="plaintext">Credential Value</Label>
                            <Input
                                id="plaintext"
                                type="password"
                                placeholder="Paste your API key, token, or secret"
                                value={editingVariable?.plaintext || ""}
                                onChange={(e) =>
                                    setEditingVariable(prev => prev ? { ...prev, plaintext: e.target.value } : null)
                                }
                            />
                            <p className="text-xs text-gray-500">
                                🔒 Encrypted with AES-256-GCM. Once created, cannot be retrieved - only rotated.
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                placeholder="e.g., Stripe production key for payment processing"
                                value={editingVariable?.description || ""}
                                onChange={(e) =>
                                    setEditingVariable(prev => prev ? { ...prev, description: e.target.value } : null)
                                }
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="gap-2"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {editingVariable?.variableName && variables.some(v => v.variableName === editingVariable.variableName)
                                ? "Update"
                                : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Credential?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-mono text-sm font-semibold text-gray-900">{deleteConfirm.name}</span>?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-2 justify-end pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirm({ open: false, name: null })}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            className="gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
