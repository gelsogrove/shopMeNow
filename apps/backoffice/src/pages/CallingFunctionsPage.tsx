import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
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
    Code
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

export default function CallingFunctionsPage() {
    const { workspaceId } = useParams<{ workspaceId: string }>()
    const navigate = useNavigate()
    const [functions, setFunctions] = useState<CallingFunction[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [testingWebhook, setTestingWebhook] = useState<string | null>(null)
    const [workspaceInfo, setWorkspaceInfo] = useState<{ name: string } | null>(null)

    useEffect(() => {
        if (workspaceId) {
            loadData()
        }
    }, [workspaceId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [functionsRes, channelsRes] = await Promise.all([
                api.callingFunctions.list(workspaceId!),
                api.getAdminConfig() // Just to get some workspace info if needed, but wait
            ])

            if (functionsRes.success) {
                setFunctions(functionsRes.data || [])
            } else {
                toast.error(functionsRes.error || "Failed to load functions")
            }

            // Try to find workspace name from channels or another source
            // For now, let's assume we can get it or just show ID
        } catch (error) {
            console.error("Load data error:", error)
            toast.error("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    const handleToggleActive = async (fn: CallingFunction) => {
        setSaving(fn.functionName)
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
        } finally {
            setSaving(null)
        }
    }

    const handleTestWebhook = async (fn: CallingFunction) => {
        if (!fn.webhookUrl) {
            toast.error("No webhook URL configured")
            return
        }
        setTestingWebhook(fn.functionName)
        try {
            const res = await api.callingFunctions.testWebhook(workspaceId!, {
                url: fn.webhookUrl,
                functionName: fn.functionName,
                parameters: {} // Empty test
            })
            if (res.success) {
                toast.success("Webhook test successful")
            } else {
                toast.error(res.error || "Webhook test failed")
            }
        } catch (error) {
            toast.error("Network error testing webhook")
        } finally {
            setTestingWebhook(null)
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
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Calling Functions</h1>
                        <p className="text-gray-500 mt-1">
                            Manage AI tools and webhooks for workspace <span className="font-mono text-xs bg-gray-100 px-1 rounded">{workspaceId}</span>
                        </p>
                    </div>
                </div>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Custom Function
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {functions.map((fn) => (
                    <Card key={fn.functionName} className={fn.isActive ? "border-l-4 border-l-blue-500" : "opacity-75"}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${fn.isSystemFunction ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                        <Code className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            {fn.functionName}
                                            {fn.isSystemFunction && (
                                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">System</span>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="mt-1">{fn.description}</CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 mr-4">
                                        <span className="text-sm font-medium text-gray-500">{fn.isActive ? "Active" : "Inactive"}</span>
                                        <Switch
                                            checked={fn.isActive}
                                            onCheckedChange={() => handleToggleActive(fn)}
                                            disabled={saving === fn.functionName}
                                        />
                                    </div>
                                    {!fn.isSystemFunction && (
                                        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-500 font-bold mb-1.5 block">Execution Type</Label>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${fn.executionType === 'WEBHOOK' ? 'bg-amber-100 text-amber-700' :
                                                    fn.executionType === 'INTERNAL' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                                                }`}>
                                                {fn.executionType}
                                            </span>
                                        </div>
                                    </div>

                                    {fn.executionType === 'WEBHOOK' && (
                                        <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium text-gray-600">Webhook URL</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={fn.webhookUrl || ""}
                                                        readOnly
                                                        className="bg-white text-sm"
                                                        placeholder="https://your-api.com/webhook"
                                                    />
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        className="shrink-0"
                                                        onClick={() => handleTestWebhook(fn)}
                                                        disabled={testingWebhook === fn.functionName}
                                                    >
                                                        {testingWebhook === fn.functionName ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Play className="h-3.5 w-3.5 mr-1" />
                                                        )}
                                                        Test
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-500 font-bold mb-1.5 block">Response Instructions</Label>
                                        <div className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-600 min-h-[60px] italic">
                                            {fn.responseInstructions || "No custom instructions. LLM will use its own judgment."}
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs uppercase text-gray-500 font-bold mb-1.5 block">Parameters Schema</Label>
                                        <pre className="text-[11px] bg-slate-900 text-slate-300 p-3 rounded-lg overflow-x-auto font-mono">
                                            {JSON.stringify(fn.parameters, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {functions.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed">
                        <Settings2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">No functions found</h3>
                        <p className="text-gray-500 mt-1">This workspace doesn't have any calling functions configured yet.</p>
                        <Button variant="outline" className="mt-6" onClick={loadData}>
                            Try refreshing
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
