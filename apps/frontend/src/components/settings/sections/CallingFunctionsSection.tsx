/**
 * CallingFunctionsSection - Custom Tools management (External Tools / Internal / Delegate)
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
    Play,
    Loader2,
    Zap,
    Code,
    Edit2,
    Lock,
    Globe,
    Cpu,
    Share2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Editor from "@monaco-editor/react"
import { callingFunctionsApi, CallingFunction } from "@/services/callingFunctionApi"
import { toast } from "@/lib/toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Execution type badge config
const EXECUTION_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    WEBHOOK: {
        label: "Webhook",
        icon: <Globe className="h-3 w-3" />,
        className: "bg-blue-50 text-blue-600 border border-blue-200",
    },
    INTERNAL: {
        label: "Internal",
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
    const [loading, setLoading] = useState(true)
    const [testingToolWebhook, setTestingToolWebhook] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingFunction, setEditingFunction] = useState<Partial<CallingFunction> | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    // Delete confirmation dialog
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; functionName: string | null }>({ open: false, functionName: null })

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
                await callingFunctionsApi.update(workspaceId, editingFunction.functionName!, payload)
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
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Wrench className="h-6 w-6 text-blue-600" />
                    Custom Tools
                </h2>
                <p className="text-sm text-gray-500 mt-1">Connect your AI to external services (Webhooks), internal logic, or specialized sub-agents</p>
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
                            {functions.map((fn) => {
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
                                                    {fn.isSystemFunction && (
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500">SYSTEM</span>
                                                    )}
                                                    {!fn.isActive && (
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inactive</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{fn.description}</p>
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
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFunction(fn.functionName)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                            {fn.isSystemFunction && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(fn)}>
                                                                <Lock className="h-4 w-4 text-slate-400" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="left">
                                                            <p>System function — read only</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
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

                        {/* Response Instructions — visible for ALL execution types */}
                        <div className="space-y-2">
                            <Label htmlFor="responseInstructions">
                                Response Instructions
                                <span className="ml-1 text-slate-400 font-normal">(optional — guides the AI on how to present the result)</span>
                            </Label>
                            <Textarea
                                id="responseInstructions"
                                value={editingFunction?.responseInstructions || ""}
                                onChange={(e) => setEditingFunction(prev => ({ ...prev, responseInstructions: e.target.value }))}
                                placeholder={editingFunction?.executionType === "WEBHOOK"
                                    ? "Guide the AI on how to present the webhook response"
                                    : editingFunction?.executionType === "DELEGATE_TO_AGENT"
                                    ? "Guide the AI on how to present the sub-agent result"
                                    : "Guide the AI on how to present the function result"}
                                rows={2}
                                disabled={editingFunction?.isSystemFunction}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        {!editingFunction?.isSystemFunction && (
                            <Button onClick={handleSaveFunction} disabled={isSaving}>
                                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Save Tool
                            </Button>
                        )}
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
