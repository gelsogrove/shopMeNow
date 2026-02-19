/**
 * CallingFunctionsSection - Gestione delle funzioni custom (External Tools)
 */
import { useEffect, useState } from "react"
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
    Settings2,
    Play,
    Loader2,
    Save,
    Zap,
    Code,
    Edit2,
    Clock,
    Globe,
    AlertTriangle,
    CheckCircle2,
    ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import Editor from "@monaco-editor/react"
import { callingFunctionsApi, CallingFunction } from "@/services/callingFunctionApi"
import { toast } from "@/lib/toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CallingFunctionsSectionProps {
    workspaceId: string
    webhookUrl: string
    webhookTimeout: number
    canEdit: boolean
    onFieldChange: (field: string, value: any) => void
    onFieldFocus?: (fieldKey: string) => void
}

export function CallingFunctionsSection({
    workspaceId,
    webhookUrl,
    webhookTimeout,
    canEdit,
    onFieldChange,
    onFieldFocus,
}: CallingFunctionsSectionProps) {
    const [functions, setFunctions] = useState<CallingFunction[]>([])
    const [loading, setLoading] = useState(true)
    const [testingWebhook, setTestingWebhook] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingFunction, setEditingFunction] = useState<Partial<CallingFunction> | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (workspaceId) {
            loadFunctions()
        }
    }, [workspaceId])

    const loadFunctions = async () => {
        try {
            setLoading(true)
            const data = await callingFunctionsApi.list(workspaceId)
            setFunctions(data)
        } catch (error) {
            console.error("Failed to load functions:", error)
            toast.error("Failed to load custom tools")
        } finally {
            setLoading(false)
        }
    }

    const handleTestWebhook = async () => {
        if (!webhookUrl) {
            toast.error("Please enter a Webhook URL first")
            return
        }

        try {
            setTestingWebhook(true)
            await callingFunctionsApi.testWebhook(workspaceId, {
                url: webhookUrl,
                timeout: webhookTimeout,
            })
            toast.success("Webhook test successful!")
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || "Webhook test failed"
            toast.error(msg)
        } finally {
            setTestingWebhook(false)
        }
    }

    const handleOpenModal = (fn?: CallingFunction) => {
        if (fn) {
            setEditingFunction({
                ...fn,
                parameters: typeof fn.parameters === 'string'
                    ? fn.parameters
                    : JSON.stringify(fn.parameters, null, 2)
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

            const payload = { ...editingFunction, parameters: parsedParams }

            if (editingFunction.id) {
                await callingFunctionsApi.update(workspaceId, editingFunction.id, payload)
                toast.success("Tool updated successfully")
            } else {
                await callingFunctionsApi.create(workspaceId, payload)
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

    const handleDeleteFunction = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this tool?")) return

        try {
            await callingFunctionsApi.delete(workspaceId, id)
            toast.success("Tool deleted")
            loadFunctions()
        } catch (error) {
            toast.error("Deletion failed")
        }
    }

    const toggleFunctionStatus = async (fn: CallingFunction) => {
        try {
            await callingFunctionsApi.update(workspaceId, fn.id, { isActive: !fn.isActive })
            setFunctions(prev => prev.map(f => f.id === fn.id ? { ...f, isActive: !f.isActive } : f))
        } catch (error) {
            toast.error("Failed to toggle status")
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Wrench className="h-6 w-6 text-blue-600" />
                    Custom Tools
                </h2>
                <p className="text-sm text-gray-500 mt-1">Connect your AI to external services via Webhooks</p>
            </div>

            {/* Webhook Configuration Card */}
            <Card>
                <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Globe className="h-5 w-5 text-blue-600" />
                        Global Webhook Settings
                    </CardTitle>
                    <CardDescription>Configure the endpoint that will receive AI tool calls</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="sm:col-span-3 space-y-2">
                            <Label htmlFor="webhookUrl">Webhook URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="webhookUrl"
                                    value={webhookUrl}
                                    onChange={(e) => onFieldChange("webhookUrl", e.target.value)}
                                    placeholder="https://api.yourdomain.com/webhook"
                                    disabled={!canEdit}
                                    onFocus={() => onFieldFocus?.("webhookUrl")}
                                    data-focus-key="webhookUrl"
                                />
                                <Button
                                    variant="outline"
                                    onClick={handleTestWebhook}
                                    disabled={!canEdit || testingWebhook || !webhookUrl}
                                    className="shrink-0"
                                >
                                    {testingWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                    Test
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="webhookTimeout">Timeout (ms)</Label>
                            <Input
                                id="webhookTimeout"
                                type="number"
                                value={webhookTimeout}
                                onChange={(e) => onFieldChange("webhookTimeout", parseInt(e.target.value))}
                                placeholder="10000"
                                disabled={!canEdit}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                            All tools configured as <strong>WEBHOOK</strong> will use this URL. Payloads are sent as JSON POST requests.
                        </span>
                    </div>
                </CardContent>
            </Card>

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
                            {functions.map((fn) => (
                                <div key={fn.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "mt-1 p-2 rounded-lg",
                                            fn.isActive ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                                        )}>
                                            <Code className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-slate-800">{fn.functionName}</span>
                                                {fn.isSystemFunction && (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500">SYSTEM</span>
                                                )}
                                                {!fn.isActive && (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inactive</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 line-clamp-1">{fn.description}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canEdit && !fn.isSystemFunction && (
                                            <>
                                                <Switch
                                                    checked={fn.isActive}
                                                    onCheckedChange={() => toggleFunctionStatus(fn)}
                                                    className="scale-75"
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenModal(fn)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteFunction(fn.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                        {fn.isSystemFunction && (
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(fn)}>
                                                <Settings2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingFunction?.id ? 'Edit Tool' : 'New Custom Tool'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fnName">Function Name (snake_case)</Label>
                                <Input
                                    id="fnName"
                                    value={editingFunction?.functionName || ""}
                                    onChange={(e) => setEditingFunction(prev => ({ ...prev, functionName: e.target.value }))}
                                    placeholder="get_order_status"
                                    disabled={editingFunction?.isSystemFunction}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="exType">Execution Type</Label>
                                <Select
                                    value={editingFunction?.executionType}
                                    onValueChange={(val: any) => setEditingFunction(prev => ({ ...prev, executionType: val }))}
                                    disabled={editingFunction?.isSystemFunction}
                                >
                                    <SelectTrigger id="exType">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEBHOOK">Webhook (External)</SelectItem>
                                        <SelectItem value="INTERNAL">Internal Logic</SelectItem>
                                        <SelectItem value="DELEGATE_TO_AGENT">Specialized Agent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fnDesc">Description (what the tool does, for the AI)</Label>
                            <Textarea
                                id="fnDesc"
                                value={editingFunction?.description || ""}
                                onChange={(e) => setEditingFunction(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Returns the status of an order given its ID"
                                rows={2}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Parameters Schema (JSON Schema)</Label>
                            <div className="border rounded-md overflow-hidden bg-white">
                                <Editor
                                    height="250px"
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
                                        readOnly: editingFunction?.isSystemFunction,
                                    }}
                                />
                            </div>
                        </div>

                        {editingFunction?.executionType === "WEBHOOK" && (
                            <div className="space-y-2">
                                <Label htmlFor="responseInstructions">Response Instructions (Optional AI guidance)</Label>
                                <Textarea
                                    id="responseInstructions"
                                    value={editingFunction?.responseInstructions || ""}
                                    onChange={(e) => setEditingFunction(prev => ({ ...prev, responseInstructions: e.target.value }))}
                                    placeholder="Guide the AI on how to present the data received from the webhook"
                                    rows={2}
                                />
                            </div>
                        )}
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
        </div>
    )
}
