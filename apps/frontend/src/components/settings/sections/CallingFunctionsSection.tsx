/**
 * CallingFunctionsSection - Custom Tools management (External Tools / Internal / Delegate)
 */
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
    Wrench,
    Plus,
    Trash2,
    Play,
    Loader2,
    Zap,
    Code,
    Edit2,
    Globe,
    Cpu,
    Share2,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Network,
    ArrowUpRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Editor from "@monaco-editor/react"
import { callingFunctionsApi, CallingFunction } from "@/services/callingFunctionApi"
import { toast } from "@/lib/toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Execution type badge config
const EXECUTION_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    WEBHOOK: {
        label: "Webhook",
        icon: <Globe className="h-3 w-3" />,
        className: "bg-blue-50 text-blue-600 border border-blue-200",
    },
    INTERNAL: {
        label: "Calling Function",
        icon: <Cpu className="h-3 w-3" />,
        className: "bg-purple-50 text-purple-600 border border-purple-200",
    },
    DELEGATE_TO_AGENT: {
        label: "Agent",
        icon: <Share2 className="h-3 w-3" />,
        className: "bg-amber-50 text-amber-600 border border-amber-200",
    },
}


interface CallingFunctionsSectionProps {
    workspaceId: string
    canEdit: boolean
    onFieldChange?: (field: string, value: any) => void
    onFieldFocus?: (fieldKey: string) => void
}

export function CallingFunctionsSection({
    workspaceId,
    canEdit,
}: CallingFunctionsSectionProps) {
    const [functions, setFunctions] = useState<CallingFunction[]>([])
    const [missingSystemFunctions, setMissingSystemFunctions] = useState<Array<{ functionName: string; description: string; executionType: string; attachedLlm?: string | null }>>([])
    const [loading, setLoading] = useState(true)
    const [testingToolWebhook, setTestingToolWebhook] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [editingFunction, setEditingFunction] = useState<Record<string, any> | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    // Delete confirmation dialog
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; functionName: string | null }>({ open: false, functionName: null })
    // Help panel visibility
    const [showHelp, setShowHelp] = useState(false)

    useEffect(() => {
        if (workspaceId) {
            loadFunctions()
        }
    }, [workspaceId])

    const loadFunctions = async () => {
        try {
            setLoading(true)
            const [data, missingData] = await Promise.all([
                callingFunctionsApi.list(workspaceId),
                callingFunctionsApi.getSystemMissing(workspaceId),
            ])
            setFunctions(data)
            setMissingSystemFunctions(missingData.missing)
        } catch (error) {
            console.error("Failed to load functions:", error)
            toast.error("Failed to load custom tools")
        } finally {
            setLoading(false)
        }
    }

    const handleReinstall = async (functionName: string) => {
        try {
            await callingFunctionsApi.reinstall(workspaceId, functionName)
            toast.success(`"${functionName}" reinstalled to factory defaults`)
            loadFunctions()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Reinstall failed")
        }
    }

    const handleTestToolWebhook = async () => {
        const url = editingFunction?.webhookUrl
        if (!url) {
            toast.error("Please enter a Webhook URL first")
            return
        }
        try {
            setTestingToolWebhook(true)
            await callingFunctionsApi.testWebhook(workspaceId, { url })
            toast.success("Webhook test successful!")
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || "Webhook test failed"
            toast.error(msg)
        } finally {
            setTestingToolWebhook(false)
        }
    }

    const handleOpenModal = (fn?: CallingFunction) => {
        if (fn) {
            setEditingFunction({
                ...fn,
                parameters: typeof fn.parameters === 'string'
                    ? fn.parameters
                    : JSON.stringify(fn.parameters, null, 2),
                credentialsMapping: fn.credentialsMapping
                    ? (typeof fn.credentialsMapping === 'string'
                        ? fn.credentialsMapping
                        : JSON.stringify(fn.credentialsMapping, null, 2))
                    : ""
            })
        } else {
            setEditingFunction({
                functionName: "",
                description: "",
                parameters: JSON.stringify({
                    type: "object",
                    properties: {
                        example_param: { type: "string", description: "An example parameter" }
                    },
                    required: ["example_param"]
                }, null, 2),
                executionType: "WEBHOOK",
                isActive: true,
                credentialsMapping: "",
            })
        }
        setIsModalOpen(true)
    }

    const handleSaveFunction = async () => {
        if (!editingFunction?.functionName || !editingFunction?.description) {
            toast.error("Please fill in all required fields")
            return
        }

        try {
            setIsSaving(true)
            let parsedParams = editingFunction.parameters
            if (typeof parsedParams === 'string') {
                try {
                    parsedParams = JSON.parse(parsedParams)
                } catch (e) {
                    toast.error("Invalid JSON in parameters")
                    return
                }
            }

            // Parse credentialsMapping if it's a non-empty string
            let parsedCredentialsMapping = editingFunction.credentialsMapping || null
            if (typeof parsedCredentialsMapping === 'string' && parsedCredentialsMapping.trim()) {
                try {
                    parsedCredentialsMapping = JSON.parse(parsedCredentialsMapping)
                } catch (e) {
                    toast.error("Invalid JSON in credentials mapping")
                    return
                }
            } else if (typeof parsedCredentialsMapping === 'string' && !parsedCredentialsMapping.trim()) {
                parsedCredentialsMapping = null
            }

            // ✅ CRITICAL: Filter payload to only include MUTABLE fields (no id, workspaceId, functionName, isSystemFunction, createdAt)
            const payload = {
                description: editingFunction.description,
                executionType: editingFunction.executionType,
                isActive: editingFunction.isActive ?? true,
                webhookUrl: editingFunction.webhookUrl || null,
                responseInstructions: editingFunction.responseInstructions || null,
                parameters: parsedParams,
                attachedLlm: editingFunction.attachedLlm || null,
                credentialsMapping: parsedCredentialsMapping
            }

            if (editingFunction.id) {
                await callingFunctionsApi.update(workspaceId, editingFunction.functionName!, payload)
                toast.success("Tool updated successfully")
            } else {
                // For CREATE, include functionName (required for new tools)
                const createPayload = { ...payload, functionName: editingFunction.functionName }
                await callingFunctionsApi.create(workspaceId, createPayload)
                toast.success("New tool added successfully")
            }

            setIsModalOpen(false)
            loadFunctions()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to save tool")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteFunction = (functionName: string) => {
        setDeleteConfirm({ open: true, functionName })
    }

    const confirmDelete = async () => {
        if (!deleteConfirm.functionName) return
        const name = deleteConfirm.functionName
        setDeleteConfirm({ open: false, functionName: null })
        try {
            await callingFunctionsApi.delete(workspaceId, name)
            toast.success("Tool deleted")
            loadFunctions()
        } catch (error) {
            toast.error("Deletion failed")
        }
    }

    const toggleFunctionStatus = async (fn: CallingFunction) => {
        try {
            await callingFunctionsApi.update(workspaceId, fn.functionName, { isActive: !fn.isActive })
            setFunctions(prev => prev.map(f => f.id === fn.id ? { ...f, isActive: !f.isActive } : f))
        } catch (error) {
            toast.error("Failed to toggle status")
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Wrench className="h-6 w-6 text-blue-600" />
                        Custom Tools
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Connect your AI to external services (Webhooks), internal logic, or specialized sub-agents
                    </p>
                </div>
                <Link to="/agents" className="shrink-0">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Network className="h-4 w-4" />
                        Agent Configuration
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                </Link>
            </div>

            {/* Functions List Card */}
            <Card>
                <CardHeader className="border-b flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Zap className="h-5 w-5 text-amber-500" />
                            Available Tools
                        </CardTitle>
                        <CardDescription>Functions the AI can call during a conversation</CardDescription>
                    </div>
                    {canEdit && (
                        <Button size="sm" onClick={() => handleOpenModal()} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Tool
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                            Loading tools...
                        </div>
                    ) : functions.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <Code className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No custom tools defined yet.</p>
                            <p className="text-sm mt-1">Add your first tool to expand your AI's capabilities.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {[...functions]
                                .sort((a, b) => {
                                    const order: Record<string, number> = { DELEGATE_TO_AGENT: 0, INTERNAL: 1, WEBHOOK: 2 }
                                    return (order[a.executionType] ?? 2) - (order[b.executionType] ?? 2)
                                })
                                .map((fn) => {
                                const typeConfig = EXECUTION_TYPE_CONFIG[fn.executionType] || EXECUTION_TYPE_CONFIG.WEBHOOK
                                return (
                                    <div key={fn.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "mt-1 p-2 rounded-lg",
                                                fn.isActive ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                                            )}>
                                                <Code className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono font-bold text-slate-800">{fn.functionName}</span>
                                                    {/* Execution type badge */}
                                                    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold", typeConfig.className)}>
                                                        {typeConfig.icon}
                                                        {typeConfig.label}
                                                    </span>
                                                    {!fn.isActive && (
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inactive</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{fn.description}</p>
                                            </div>
                                        </div>

                                        {canEdit && (
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Switch
                                                    checked={fn.isActive}
                                                    onCheckedChange={() => toggleFunctionStatus(fn)}
                                                    className="scale-75"
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenModal(fn)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                {fn.isSystemFunction ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" onClick={() => handleReinstall(fn.functionName)} className="text-teal-500 hover:text-teal-700 hover:bg-teal-50">
                                                                    <RefreshCw className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left">
                                                                <p>Reinstall to factory defaults</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : null}
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteFunction(fn.functionName)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Missing System Functions — available for this workspace but not installed */}
            {canEdit && missingSystemFunctions.length > 0 && (
                <Card className="border-dashed border-amber-200 bg-amber-50/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                            <RefreshCw className="h-4 w-4 text-amber-500" />
                            Available System Functions ({missingSystemFunctions.length} not installed)
                        </CardTitle>
                        <CardDescription className="text-amber-700 text-xs">These system functions are available for your workspace but were removed. Click Reinstall to add them back.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-amber-100">
                            {missingSystemFunctions.map((fn) => {
                                const typeConfig = EXECUTION_TYPE_CONFIG[fn.executionType] || EXECUTION_TYPE_CONFIG.WEBHOOK
                                return (
                                    <div key={fn.functionName} className="px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 p-1.5 rounded-lg bg-amber-100 text-amber-600">
                                                <Code className="h-3.5 w-3.5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-sm text-slate-700">{fn.functionName}</span>
                                                    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold", typeConfig.className)}>
                                                        {typeConfig.icon}
                                                        {typeConfig.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{fn.description}</p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 text-teal-700 border-teal-300 hover:bg-teal-50 shrink-0"
                                            onClick={() => handleReinstall(fn.functionName)}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            Reinstall
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Help & Documentation Panel */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader
                    className="cursor-pointer select-none"
                    onClick={() => setShowHelp(!showHelp)}
                >
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-blue-600" />
                            Custom Tools Guide
                        </span>
                        {showHelp ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                    </CardTitle>
                    <CardDescription>Learn how to create and configure custom tools for your AI</CardDescription>
                </CardHeader>

                {showHelp && (
                    <CardContent>
                        <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="types">Tool Types</TabsTrigger>
                                <TabsTrigger value="credentials">Credentials</TabsTrigger>
                                <TabsTrigger value="examples">Examples</TabsTrigger>
                            </TabsList>

                            {/* TAB: OVERVIEW */}
                            <TabsContent value="overview" className="space-y-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3">🛠️ What are Custom Tools?</h3>
                                    <p className="text-sm text-gray-700 mb-3">
                                        Custom tools extend your AI assistant's capabilities by connecting it to external services, internal logic, or specialized sub-agents. When the AI determines it needs to perform a specific action, it calls the appropriate tool.
                                    </p>
                                    <div className="space-y-3">
                                        <div className="border-l-4 border-blue-500 pl-4">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">How It Works</p>
                                            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                                                <li>You define a tool with a name, description, and parameters</li>
                                                <li>The AI reads the description to decide <strong>when</strong> to call it</li>
                                                <li>When triggered, the system executes the tool (webhook call, internal logic, or sub-agent)</li>
                                                <li>The result is returned to the AI, which formats it for the user</li>
                                            </ol>
                                        </div>
                                        <div className="border-l-4 border-green-500 pl-4">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">Tool Components</p>
                                            <ul className="text-sm text-gray-600 space-y-1">
                                                <li>• <strong>Function Name:</strong> Unique camelCase identifier (e.g., <code className="bg-slate-100 px-1 rounded">getWeather</code>)</li>
                                                <li>• <strong>Description:</strong> Tells the AI <em>when</em> to use this tool</li>
                                                <li>• <strong>Parameters Schema:</strong> JSON Schema defining expected inputs</li>
                                                <li>• <strong>Response Instructions:</strong> Guides how the AI presents the result</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* TAB: TOOL TYPES */}
                            <TabsContent value="types" className="space-y-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">📋 Execution Types</h3>

                                    <div className="border-l-4 border-blue-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">🌐 Webhook (External API)</p>
                                        <p className="text-sm text-gray-700">
                                            <strong>Calls your own server/API</strong> via HTTP POST. Use when you need to integrate with external systems, run custom business logic on your infrastructure, or connect to third-party services (Stripe, CRMs, ERPs, etc.). You control the endpoint and implementation.
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">✅ Best for: Payment processing, inventory sync, custom calculations, external data lookups</p>
                                    </div>

                                    <div className="border-l-4 border-purple-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">⚙️ Internal Logic (Platform Built-in)</p>
                                        <p className="text-sm text-gray-700">
                                            <strong>Executes code inside the eChatbot platform</strong>. System functions (orders, cart, profile) use this type. You cannot create new INTERNAL functions — this type is reserved for platform-managed operations that directly interact with the database.
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">⚠️ System functions only — not available for custom tools</p>
                                    </div>

                                    <div className="border-l-4 border-amber-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">🤖 Specialized Agent (AI Sub-agent)</p>
                                        <p className="text-sm text-gray-700">
                                            <strong>Delegates to a specialized AI with its own prompt and context</strong>. Instead of calling an API, this triggers a full AI agent with domain expertise (e.g., product search, legal advice, order tracking). The sub-agent analyzes the request and generates a natural language response.
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">✅ Best for: Complex reasoning tasks, multi-step conversations, domain-specific expertise</p>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-900">
                                    <p className="font-semibold mb-1">🔒 System vs Custom Tools</p>
                                    <p>
                                        <strong>System tools</strong> (lock icon) are platform-managed and cannot be deleted or re-configured. They handle core operations like orders, cart, and profile management. <strong>Custom tools</strong> are user-created and fully editable.
                                    </p>
                                </div>
                            </TabsContent>

                            {/* TAB: CREDENTIALS */}
                            <TabsContent value="credentials" className="space-y-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3">🔐 Credentials Mapping</h3>
                                    <p className="text-sm text-gray-700 mb-3">
                                        When your webhook requires authentication, use the <strong>Credentials Mapping</strong> to inject environment variables securely into the request — without exposing secrets in the tool configuration.
                                    </p>

                                    <div className="space-y-4">
                                        <div className="border-l-4 border-blue-500 pl-4">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">Step 1: Add an Environment Variable</p>
                                            <p className="text-sm text-gray-600">
                                                Go to the <strong>Environment Variables</strong> section below and add your API key (e.g., <code className="bg-slate-100 px-1 rounded">STRIPE_API_KEY</code>). It will be encrypted at rest.
                                            </p>
                                        </div>

                                        <div className="border-l-4 border-indigo-500 pl-4">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">Step 2: Configure Credentials Mapping</p>
                                            <p className="text-sm text-gray-600 mb-2">In the tool's Credentials Mapping field, specify where to inject:</p>
                                            <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`{
  "stripe_auth": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "STRIPE_API_KEY"
  }
}`}</pre>
                                        </div>

                                        <div className="border-l-4 border-green-500 pl-4">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">Injection Locations</p>
                                            <ul className="text-sm text-gray-600 space-y-1">
                                                <li>• <strong>header</strong> — Adds as HTTP header (e.g., <code className="bg-slate-100 px-1 rounded">Authorization: Bearer ...</code>)</li>
                                                <li>• <strong>querystring</strong> — Appends as URL parameter (e.g., <code className="bg-slate-100 px-1 rounded">?apikey=...</code>)</li>
                                                <li>• <strong>body</strong> — Merges into JSON payload (e.g., <code className="bg-slate-100 px-1 rounded">{`{ "api_key": "..." }`}</code>)</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm text-green-900">
                                    <p className="font-semibold mb-1">✅ Security Guarantee</p>
                                    <p>
                                        Credentials are encrypted with AES-256-GCM, decrypted only at dispatch time, and <strong>never logged or stored in plain text</strong>. Each workspace has isolated encryption.
                                    </p>
                                </div>
                            </TabsContent>

                            {/* TAB: EXAMPLES */}
                            <TabsContent value="examples" className="space-y-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">💡 Example Tools</h3>

                                    <div className="border-l-4 border-blue-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">Weather Lookup (Webhook)</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`Function Name: getWeather
Description: "Call when the user asks about weather conditions"
Parameters: {
  "type": "object",
  "properties": {
    "city": { "type": "string", "description": "City name" }
  },
  "required": ["city"]
}
Webhook URL: https://api.weather.com/v1/forecast
Credentials Mapping: {
  "api_auth": {
    "location": "querystring",
    "paramName": "appid",
    "variableName": "WEATHER_API_KEY"
  }
}`}</pre>
                                    </div>

                                    <div className="border-l-4 border-purple-500 pl-4">
                                        <p className="font-semibold text-gray-900 text-sm mb-1">Send Email (Webhook)</p>
                                        <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{`Function Name: sendEmail
Description: "Send email when the user requests a quote"
Parameters: {
  "type": "object",
  "properties": {
    "to": { "type": "string" },
    "subject": { "type": "string" },
    "body": { "type": "string" }
  },
  "required": ["to", "subject", "body"]
}
Webhook URL: https://api.sendgrid.com/v3/mail/send
Credentials Mapping: {
  "sg_auth": {
    "location": "header",
    "paramName": "Authorization",
    "format": "Bearer \${value}",
    "variableName": "SENDGRID_API_KEY"
  }
}`}</pre>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                )}
            </Card>

            {/* Edit Modal - Horizontal 2-Column Layout */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingFunction?.id ? 'Edit Tool' : 'New Custom Tool'}</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            {editingFunction?.isSystemFunction && '🔒 System tool - only description, execution type, and response instructions can be edited'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-6 py-4">
                        {/* LEFT COLUMN - Basic Info */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fnName">Function Name <span className="text-slate-400 font-normal">(camelCase)</span></Label>
                                <Input
                                    id="fnName"
                                    value={editingFunction?.functionName || ""}
                                    onChange={(e) => setEditingFunction(prev => ({ ...prev, functionName: e.target.value }))}
                                    placeholder="getOrderStatus"
                                    disabled={editingFunction?.isSystemFunction}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="exType">Execution Type</Label>
                                <Select
                                    value={editingFunction?.executionType}
                                    onValueChange={(val: any) => setEditingFunction(prev => ({ ...prev, executionType: val }))}
                                >
                                    <SelectTrigger id="exType">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEBHOOK">🌐 Webhook (External API)</SelectItem>
                                        <SelectItem value="INTERNAL">⚙️ Internal Logic (System)</SelectItem>
                                        <SelectItem value="DELEGATE_TO_AGENT">🤖 Specialized Agent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fnDesc">Description (what the tool does, for the AI)</Label>
                                <Textarea
                                    id="fnDesc"
                                    value={editingFunction?.description || ""}
                                    onChange={(e) => setEditingFunction(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Returns the status of an order given its ID"
                                    rows={3}
                                />
                            </div>

                            {/* Response Instructions - in LEFT column */}
                            <div className="space-y-2">
                                <Label htmlFor="responseInstructions">
                                    Response Instructions
                                    <span className="ml-1 text-slate-400 font-normal">(optional)</span>
                                </Label>
                                <Textarea
                                    id="responseInstructions"
                                    value={editingFunction?.responseInstructions || ""}
                                    onChange={(e) => setEditingFunction(prev => ({ ...prev, responseInstructions: e.target.value }))}
                                    placeholder="Guide the AI on how to present the result"
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* RIGHT COLUMN - Technical Details */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Parameters Schema (JSON Schema)</Label>
                                <div className="border rounded-md overflow-hidden bg-white">
                                    <Editor
                                        height="200px"
                                    defaultLanguage="json"
                                    theme="vs-light"
                                    value={editingFunction?.parameters || ""}
                                    onChange={(val) => setEditingFunction(prev => ({ ...prev, parameters: val }))}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 12,
                                        lineNumbers: "on",
                                        scrollBeyondLastLine: false,
                                        automaticLayout: true,
                                    }}
                                />
                            </div>
                        </div>

                            {/* Webhook URL — only for WEBHOOK type */}
                            {editingFunction?.executionType === "WEBHOOK" && (
                            <div className="space-y-2">
                                <Label htmlFor="toolWebhookUrl">Webhook URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="toolWebhookUrl"
                                        value={editingFunction?.webhookUrl || ""}
                                        onChange={(e) => setEditingFunction(prev => ({ ...prev, webhookUrl: e.target.value }))}
                                        placeholder="https://api.yourdomain.com/webhook"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleTestToolWebhook}
                                        disabled={testingToolWebhook || !editingFunction?.webhookUrl}
                                        className="shrink-0"
                                    >
                                        {testingToolWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                        Test
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-500">Payload sent as JSON POST request when AI calls this tool.</p>
                            </div>
                            )}

                            {/* Credentials Mapping — only for WEBHOOK type */}
                            {editingFunction?.executionType === "WEBHOOK" && (
                            <div className="space-y-2">
                                <Label>
                                    Credentials Mapping
                                    <span className="ml-1 text-slate-400 font-normal">(optional — inject environment variables into the request)</span>
                                </Label>
                                <div className="border rounded-md overflow-hidden bg-white">
                                    <Editor
                                        height="120px"
                                        defaultLanguage="json"
                                        theme="vs-light"
                                        value={typeof editingFunction?.credentialsMapping === 'string'
                                            ? editingFunction.credentialsMapping
                                            : editingFunction?.credentialsMapping
                                                ? JSON.stringify(editingFunction.credentialsMapping, null, 2)
                                                : ""}
                                        onChange={(val) => setEditingFunction(prev => ({ ...prev, credentialsMapping: val }))}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 12,
                                            lineNumbers: "off",
                                            scrollBeyondLastLine: false,
                                            automaticLayout: true,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500">
                                    Maps environment variables to request locations. Format: <code className="bg-slate-100 px-1 rounded">
                                    {`{ "VAR_NAME": { "location": "header|querystring|body", "paramName": "header-or-param-name" } }`}
                                    </code>
                                </p>
                            </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveFunction} disabled={isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Save Tool
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirm.open}
                onOpenChange={(open) => !open && setDeleteConfirm({ open: false, functionName: null })}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Tool</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete{" "}
                            <span className="font-mono font-bold">{deleteConfirm.functionName}</span>?{" "}
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirm({ open: false, functionName: null })}
                        >
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
