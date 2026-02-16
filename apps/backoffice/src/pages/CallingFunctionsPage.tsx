import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    ArrowLeft,
    Plus,
    Trash2,
    Settings2,
    Globe,
    Key,
    Clock,
    Play,
    Loader2,
    Save,
    AlertTriangle,
    CheckCircle2,
    Code,
    Edit2,
    Copy,
    ExternalLink,
    ShieldCheck,
    Zap
} from "lucide-react"
import { toast } from "@/lib/toast"

interface CallingFunction {
    id: string
    workspaceId: string
    functionName: string
    description: string
    parameters: any
    executionType: "INTERNAL" | "WEBHOOK" | "DELEGATE_TO_AGENT"
    isActive: boolean
    isSystemFunction: boolean
    webhookUrl?: string | null
    responseInstructions?: string | null
}

interface WorkspaceConfig {
    id: string
    name: string
    webhookTimeout: number
}

export default function CallingFunctionsPage() {
    const { workspaceId } = useParams<{ workspaceId: string }>()
    const navigate = useNavigate()

    const [functions, setFunctions] = useState<CallingFunction[]>([])
    const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [savingSettings, setSavingSettings] = useState(false)
    const [savingFunction, setSavingFunction] = useState(false)
    const [testingWebhook, setTestingWebhook] = useState<string | null>(null)

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingFunction, setEditingFunction] = useState<Partial<CallingFunction> | null>(null)

    useEffect(() => {
        if (workspaceId) {
            loadData()
        }
    }, [workspaceId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [functionsRes, workspaceRes] = await Promise.all([
                api.callingFunctions.list(workspaceId!),
                api.workspaces.get(workspaceId!)
            ])

            if (functionsRes.success) {
                setFunctions(functionsRes.data || [])
            } else {
                toast.error(functionsRes.error || "Failed to load functions")
            }

            if (workspaceRes.success) {
                setWorkspace(workspaceRes.data)
            } else {
                toast.error(workspaceRes.error || "Failed to load workspace settings")
            }
        } catch (error) {
            console.error("Load data error:", error)
            toast.error("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateWorkspace = async () => {
        if (!workspace) return
        setSavingSettings(true)
        try {
            const res = await api.workspaces.update(workspaceId!, {
                webhookTimeout: workspace.webhookTimeout
            })
            if (res.success) {
                toast.success("Settings updated successfully")
            } else {
                toast.error(res.error || "Update failed")
            }
        } catch (error) {
            toast.error("Network error")
        } finally {
            setSavingSettings(false)
        }
    }

    const handleToggleActive = async (fn: CallingFunction) => {
        try {
            const res = await api.callingFunctions.update(workspaceId!, fn.functionName, {
                isActive: !fn.isActive
            })
            if (res.success) {
                setFunctions(prev => prev.map(f => f.functionName === fn.functionName ? { ...f, isActive: !f.isActive } : f))
                toast.success(`Function ${!fn.isActive ? 'enabled' : 'disabled'}`)
            } else {
                toast.error(res.error || "Update failed")
            }
        } catch (error) {
            toast.error("Network error")
        }
    }

    const handleTestWebhook = async (fn: CallingFunction) => {
        if (!fn.webhookUrl) {
            toast.error("No webhook URL configured for this function")
            return
        }
        setTestingWebhook(fn.functionName)
        try {
            const res = await api.callingFunctions.testWebhook(workspaceId!, {
                url: fn.webhookUrl,
                functionName: fn.functionName,
                parameters: { test: true }
            })
            if (res.success) {
                toast.success("Webhook test successful!")
            } else {
                toast.error(res.error || "Webhook test failed")
            }
        } catch (error) {
            toast.error("Network error testing webhook")
        } finally {
            setTestingWebhook(null)
        }
    }

    const handleOpenCreateModal = () => {
        setEditingFunction({
            functionName: "",
            description: "",
            executionType: "WEBHOOK",
            isActive: true,
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        })
        setIsModalOpen(true)
    }

    const handleOpenEditModal = (fn: CallingFunction) => {
        setEditingFunction({ ...fn })
        setIsModalOpen(true)
    }

    const handleSaveFunction = async () => {
        if (!editingFunction?.functionName) return
        setSavingFunction(true)
        try {
            let res
            const isNew = !functions.find(f => f.functionName === editingFunction.functionName) || !editingFunction.id

            const payload = {
                description: editingFunction.description,
                executionType: editingFunction.executionType,
                isActive: editingFunction.isActive,
                webhookUrl: editingFunction.webhookUrl,
                responseInstructions: editingFunction.responseInstructions,
                parameters: typeof editingFunction.parameters === 'string'
                    ? JSON.parse(editingFunction.parameters)
                    : editingFunction.parameters
            }

            if (isNew) {
                res = await api.callingFunctions.create(workspaceId!, {
                    ...payload,
                    functionName: editingFunction.functionName
                })
            } else {
                res = await api.callingFunctions.update(workspaceId!, editingFunction.functionName, payload)
            }

            if (res.success) {
                toast.success(isNew ? "Function created" : "Function updated")
                setIsModalOpen(false)
                loadData()
            } else {
                toast.error(res.error || "Save failed")
            }
        } catch (error: any) {
            console.error("Save error:", error)
            toast.error(error?.message || "Save failed. Check JSON parameters")
        } finally {
            setSavingFunction(false)
        }
    }

    const handleDeleteFunction = async (functionName: string) => {
        if (!confirm(`Are you sure you want to delete function '${functionName}'?`)) return
        try {
            const res = await api.callingFunctions.delete(workspaceId!, functionName)
            if (res.success) {
                toast.success("Function deleted")
                setFunctions(prev => prev.filter(f => f.functionName !== functionName))
            } else {
                toast.error(res.error || "Delete failed")
            }
        } catch (error) {
            toast.error("Network error")
        }
    }


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/channels")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Channels
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Calling Functions</h1>
                        <p className="text-gray-500 mt-1">
                            Configuration for <span className="font-semibold text-gray-900">{workspace?.name || workspaceId}</span>
                        </p>
                    </div>
                </div>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleOpenCreateModal}>
                    <Plus className="h-4 w-4" />
                    Add Custom Tool
                </Button>
            </div>

            {/* Webhook Settings Card */}
            <Card className="border-2 border-blue-50 bg-blue-50/20 shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b pb-4">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-600" />
                        <div>
                            <CardTitle className="text-lg">Global Webhook Settings</CardTitle>
                            <CardDescription>Configure security and performance for external function calls</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 bg-white/50 backdrop-blur-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Request Timeout (ms)
                            </Label>
                            <Input
                                type="number"
                                value={workspace?.webhookTimeout || 10000}
                                onChange={(e) => setWorkspace(prev => prev ? { ...prev, webhookTimeout: parseInt(e.target.value) } : null)}
                                placeholder="10000"
                                className="bg-white"
                            />
                            <p className="text-[10px] text-gray-500">Maximum time to wait for a webhook response (min 1000ms).</p>
                        </div>

                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleUpdateWorkspace}
                            disabled={savingSettings}
                        >
                            {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Global Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        Available Tools
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{functions.length}</span>
                    </h2>
                </div>

                {functions.map((fn) => (
                    <Card key={fn.functionName} className={`transition-all hover:shadow-md ${fn.isActive ? "border-l-4 border-l-blue-500" : "opacity-75 grayscale"}`}>
                        <CardHeader className="pb-3 border-b bg-gray-50/50">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${fn.isSystemFunction ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                        <Code className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            {fn.functionName}
                                            {fn.isSystemFunction && (
                                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-purple-200">System</span>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="mt-1 flex items-center gap-2">
                                            {fn.description}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 mr-4 bg-white px-3 py-1 rounded-full border shadow-sm">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">{fn.isActive ? "Live" : "Disabled"}</span>
                                        <Switch
                                            checked={fn.isActive}
                                            onCheckedChange={() => handleToggleActive(fn)}
                                        />
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(fn)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        {!fn.isSystemFunction && (
                                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteFunction(fn.functionName)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <Label className="text-[10px] uppercase text-gray-400 font-extrabold mb-2 block tracking-widest">Execution Mode</Label>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${fn.executionType === 'WEBHOOK' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                fn.executionType === 'INTERNAL' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-green-50 text-green-700 border-green-200'
                                                }`}>
                                                {fn.executionType === 'WEBHOOK' ? '📡 WEBHOOK DISPATCH' :
                                                    fn.executionType === 'INTERNAL' ? '💻 SYSTEM INTERNAL' :
                                                        '👥 DELEGATE TO AGENT'}
                                            </span>
                                        </div>
                                    </div>

                                    {fn.executionType === 'WEBHOOK' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                                    <Globe className="h-3.5 w-3.5" />
                                                    Endpoint URL
                                                </Label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <Input
                                                            value={fn.webhookUrl || ""}
                                                            readOnly
                                                            className="bg-white text-xs font-mono pr-8"
                                                            placeholder="No URL configured"
                                                        />
                                                        {fn.webhookUrl && (
                                                            <a href={fn.webhookUrl} target="_blank" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="shrink-0 bg-white border font-bold text-xs"
                                                        onClick={() => handleTestWebhook(fn)}
                                                        disabled={testingWebhook === fn.functionName}
                                                    >
                                                        {testingWebhook === fn.functionName ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                                                        )}
                                                        Test Hook
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <Label className="text-[10px] uppercase text-gray-400 font-extrabold mb-2 block tracking-widest">Parameter Schema</Label>
                                        <div className="relative group">
                                            <pre className="text-[10px] bg-slate-900 text-slate-300 p-4 rounded-xl overflow-x-auto font-mono max-h-[300px] shadow-lg leading-relaxed">
                                                {JSON.stringify(fn.parameters, null, 2)}
                                            </pre>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(JSON.stringify(fn.parameters, null, 2))
                                                    toast.success("Schema copied to clipboard")
                                                }}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <Label className="text-[10px] uppercase text-gray-400 font-extrabold mb-2 block tracking-widest">Post-Execution Response Instructions</Label>
                                        <div className="text-sm bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-gray-600 min-h-[100px] leading-relaxed relative">
                                            <span className="absolute -top-2 left-4 px-2 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">AI Guidance</span>
                                            {fn.responseInstructions || "The AI will automatically handle the output from this function. No specific instructions provided."}
                                        </div>
                                        <p className="mt-2 text-[10px] text-gray-400 italic">
                                            Instructions provided here will be appended to the LLM prompt after the function returns data.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {functions.length === 0 && (
                    <div className="text-center py-32 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
                        <div className="bg-white p-6 rounded-full shadow-sm mb-6 border border-gray-100">
                            <Settings2 className="h-12 w-12 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No active tools configured</h3>
                        <p className="text-gray-500 mt-2 max-w-sm">
                            Connect your AI agent to external APIs or internal logic by adding custom tools.
                        </p>
                        <Button size="lg" className="mt-8 bg-blue-600 hover:bg-blue-700 rounded-full px-8" onClick={handleOpenCreateModal}>
                            <Plus className="h-5 w-5 mr-2" />
                            Create First Tool
                        </Button>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <Settings2 className="h-6 w-6 text-blue-600" />
                            {editingFunction?.id ? `Edit Tool: ${editingFunction.functionName}` : 'Add New Custom Tool'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold">Function Name (unique, no spaces)</Label>
                                <Input
                                    value={editingFunction?.functionName || ""}
                                    onChange={(e) => setEditingFunction(prev => prev ? { ...prev, functionName: e.target.value } : null)}
                                    placeholder="e.g. check_order_status"
                                    disabled={!!editingFunction?.id}
                                />
                                <p className="text-[11px] text-gray-500">This must match the OpenAI tool name definition.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-bold">Short Description</Label>
                                <Input
                                    value={editingFunction?.description || ""}
                                    onChange={(e) => setEditingFunction(prev => prev ? { ...prev, description: e.target.value } : null)}
                                    placeholder="What does this function do?"
                                />
                                <p className="text-[11px] text-gray-500">Visible to the LLM to decide when to call this tool.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-bold">Execution Type</Label>
                                <Select
                                    value={editingFunction?.executionType || "WEBHOOK"}
                                    onValueChange={(val: any) => setEditingFunction(prev => prev ? { ...prev, executionType: val } : null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="WEBHOOK">📡 Webhook Dispatch</SelectItem>
                                        <SelectItem value="INTERNAL">💻 System Internal</SelectItem>
                                        <SelectItem value="DELEGATE_TO_AGENT">👥 Delegate to Human Agent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {editingFunction?.executionType === 'WEBHOOK' && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-bold">Webhook URL</Label>
                                    <Input
                                        value={editingFunction?.webhookUrl || ""}
                                        onChange={(e) => setEditingFunction(prev => prev ? { ...prev, webhookUrl: e.target.value } : null)}
                                        placeholder="https://your-api.com/v1/webhook"
                                    />
                                    <p className="text-[11px] text-gray-500">We will send a POST request with HMAC signature.</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-sm font-bold">Response Instructions (Optional)</Label>
                                <Textarea
                                    className="min-h-[120px]"
                                    value={editingFunction?.responseInstructions || ""}
                                    onChange={(e) => setEditingFunction(prev => prev ? { ...prev, responseInstructions: e.target.value } : null)}
                                    placeholder="e.g. Read the 'status' field from the response. If it's 'delivered', congratulate the user."
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-bold">JSON Parameters Schema</Label>
                                    <Button variant="ghost" size="xs" className="text-[10px] h-6" onClick={() => {
                                        const template = {
                                            type: "object",
                                            properties: {
                                                param_name: { type: "string", description: "Description of param" }
                                            },
                                            required: ["param_name"]
                                        }
                                        setEditingFunction(prev => prev ? { ...prev, parameters: JSON.stringify(template, null, 2) } : null)
                                    }}>
                                        Insert Template
                                    </Button>
                                </div>
                                <Textarea
                                    className="font-mono text-xs min-h-[350px] bg-slate-900 text-slate-300"
                                    value={typeof editingFunction?.parameters === 'string' ? editingFunction.parameters : JSON.stringify(editingFunction?.parameters || {}, null, 2)}
                                    onChange={(e) => setEditingFunction(prev => prev ? { ...prev, parameters: e.target.value } : null)}
                                />
                                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded border border-amber-100">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-[10px] text-amber-800 leading-relaxed">
                                        Must follow OpenAI tool parameter schema format.
                                        Invalid JSON will cause the tool to fail or go unnoticed by the LLM.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <Switch
                                    checked={editingFunction?.isActive}
                                    onCheckedChange={(val) => setEditingFunction(prev => prev ? { ...prev, isActive: val } : null)}
                                />
                                <div>
                                    <Label className="text-sm font-bold block">Tool Active</Label>
                                    <p className="text-[11px] text-gray-500">If disabled, the LLM won't be aware of this tool.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="bg-gray-50 -mx-6 -mb-6 p-6 mt-4 border-t gap-3">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 min-w-[140px]"
                            onClick={handleSaveFunction}
                            disabled={savingFunction}
                        >
                            {savingFunction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {editingFunction?.id ? 'Update Tool' : 'Create Tool'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
