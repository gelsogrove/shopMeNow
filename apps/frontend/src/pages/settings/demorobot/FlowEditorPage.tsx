import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Save, Loader2, AlertCircle } from "lucide-react"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { toast } from "@/lib/toast"
import { flowApi, assetApi, Flow, FlowNode, FlowEdge as ApiFlowEdge, Asset, ValidationError } from "@/services/demoRobotApi"
import { FlowQuestionNode, type FlowQuestionNodeData } from "@/components/demorobot/FlowQuestionNode"
import { FlowNodePanel } from "@/components/demorobot/FlowNodePanel"

const nodeTypes = { question: FlowQuestionNode }

function apiNodeToFlowNode(n: FlowNode, edges: ApiFlowEdge[]): Node<FlowQuestionNodeData> {
  const answers = edges
    .filter((e) => e.sourceNodeId === n.id)
    .map((e) => ({ edgeId: e.id, label: e.label, triggersEscalation: e.triggersEscalation }))
  return {
    id: n.id,
    type: "question",
    position: { x: n.positionX, y: n.positionY },
    data: {
      question: n.question,
      answers,
      attachmentCount: n.attachments.length,
      terminalType: n.terminalType,
      fieldKey: n.fieldKey ?? "",
      fieldType: n.fieldType ?? "",
      attachedAssetIds: n.attachments.map((a) => a.assetId),
    } as FlowQuestionNodeData & { fieldKey: string; fieldType: string; attachedAssetIds: string[] },
  }
}

function apiEdgeToFlowEdge(e: ApiFlowEdge): Edge {
  return {
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId ?? "",
    sourceHandle: e.id,
    label: e.label,
    data: { triggersEscalation: e.triggersEscalation, label: e.label },
    style: e.triggersEscalation ? { stroke: "#f59e0b" } : undefined,
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function FlowEditorInner() {
  const { workspace } = useWorkspace()
  const { robotModelId, flowId } = useParams<{ robotModelId: string; flowId: string }>()
  const navigate = useNavigate()
  const workspaceId = workspace?.id || ""
  const { addNodes, addEdges: rfAddEdges } = useReactFlow()

  const [flow, setFlow] = useState<Flow | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowQuestionNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [title, setTitle] = useState("")

  const [panelNodeId, setPanelNodeId] = useState<string | null>(null)
  const panelOpen = panelNodeId !== null

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  useEffect(() => {
    if (!workspaceId || !flowId) return
    setIsLoading(true)
    flowApi
      .getGraph(workspaceId, flowId)
      .then((graph) => {
        setFlow(graph.flow)
        setTitle(graph.flow.title)
        setNodes(graph.nodes.map((n) => apiNodeToFlowNode(n, graph.edges)))
        setEdges(graph.edges.map(apiEdgeToFlowEdge))
      })
      .catch((err) => toast.error(err.message || "Failed to load flow"))
      .finally(() => setIsLoading(false))
  }, [workspaceId, flowId, setNodes, setEdges])

  useEffect(() => {
    if (!workspaceId || !robotModelId || robotModelId === "generic") return
    assetApi.list(workspaceId, robotModelId).then(setAssets).catch(() => {})
  }, [workspaceId, robotModelId])

  // specs/flow-graph-editor "Adding an answer creates a linked child node":
  // one atomic action — create the FlowEdge, auto-create a connected child
  // FlowNode, wire target immediately. Never leaves an orphaned edge.
  const handleAddAnswer = useCallback(
    (nodeId: string, label: string) => {
      const parent = nodesRef.current.find((n) => n.id === nodeId)
      if (!parent) return

      const edgeId = newId("edge")
      const childId = newId("node")
      const answerIndex = parent.data.answers.length

      const childNode: Node<FlowQuestionNodeData> = {
        id: childId,
        type: "question",
        position: { x: parent.position.x + 280, y: parent.position.y + answerIndex * 120 },
        data: { question: "", answers: [], attachmentCount: 0, terminalType: null } as FlowQuestionNodeData,
      }
      addNodes(childNode)

      const newEdge: Edge = {
        id: edgeId,
        source: nodeId,
        target: childId,
        sourceHandle: edgeId,
        label,
        data: { triggersEscalation: false, label },
      }
      rfAddEdges(newEdge)

      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, answers: [...n.data.answers, { edgeId, label, triggersEscalation: false }] } }
            : n,
        ),
      )
    },
    [addNodes, rfAddEdges, setNodes],
  )

  const handleRemoveAnswer = useCallback(
    (nodeId: string, edgeId: string) => {
      setEdges((prev) => prev.filter((e) => e.id !== edgeId))
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, answers: n.data.answers.filter((a) => a.edgeId !== edgeId) } } : n,
        ),
      )
    },
    [setEdges, setNodes],
  )

  const handleToggleAnswerEscalation = useCallback(
    (nodeId: string, edgeId: string, value: boolean) => {
      setEdges((prev) => prev.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, triggersEscalation: value }, style: value ? { stroke: "#f59e0b" } : undefined } : e)))
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, answers: n.data.answers.map((a) => (a.edgeId === edgeId ? { ...a, triggersEscalation: value } : a)) } }
            : n,
        ),
      )
    },
    [setEdges, setNodes],
  )

  // design.md Decision 12: updateNodeData-equivalent, debounced by the panel itself.
  const handleNodeDataChange = useCallback(
    (nodeId: string, patch: Partial<FlowQuestionNodeData>) => {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)))
    },
    [setNodes],
  )

  const handleToggleAttachment = useCallback(
    (nodeId: string, assetId: string, attached: boolean) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n
          const current: string[] = (n.data as any).attachedAssetIds ?? []
          const next = attached ? Array.from(new Set([...current, assetId])) : current.filter((id) => id !== assetId)
          return { ...n, data: { ...n.data, attachedAssetIds: next, attachmentCount: next.length } as any }
        }),
      )
    },
    [setNodes],
  )

  // Manual reconnect-to-existing-node (specs/flow-graph-editor): native React
  // Flow drag, sourceHandle carries the FlowEdge id already.
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((prev) => addEdge({ ...connection, id: connection.sourceHandle ?? newId("edge") }, prev))
    },
    [setEdges],
  )

  const selectedNode = panelNodeId ? nodes.find((n) => n.id === panelNodeId) ?? null : null
  const attachedAssetIds = selectedNode ? ((selectedNode.data as any).attachedAssetIds as string[]) ?? [] : []

  const handleSave = async () => {
    if (!workspaceId || !flowId) return
    setIsSaving(true)
    setValidationErrors([])
    try {
      const payload = {
        title,
        nodes: nodes.map((n) => ({
          id: n.id,
          flowId: flowId!,
          question: n.data.question,
          positionX: n.position.x,
          positionY: n.position.y,
          fieldKey: (n.data as any).fieldKey || null,
          fieldType: (n.data as any).fieldType || null,
          terminalType: n.data.terminalType,
          attachmentAssetIds: (n.data as any).attachedAssetIds ?? [],
        })),
        edges: edges.map((e) => ({
          id: e.id,
          sourceNodeId: e.source,
          targetNodeId: e.target || null,
          label: (e.data as any)?.label ?? (typeof e.label === "string" ? e.label : ""),
          triggersEscalation: !!(e.data as any)?.triggersEscalation,
        })),
      }
      const result = await flowApi.saveGraph(workspaceId, flowId, payload)
      if (!result.ok) {
        setValidationErrors(result.validationReport ?? [])
        toast.error("Flow has validation errors — see highlighted nodes")
        return
      }
      toast.success("Flow saved and online")
      if (result.flow) setFlow(result.flow)
    } catch (err: any) {
      toast.error(err.message || "Failed to save flow")
    } finally {
      setIsSaving(false)
    }
  }

  const errorNodeIds = new Set(validationErrors.map((e) => e.nodeId).filter(Boolean))
  const displayNodes = nodes.map((n) => ({
    ...n,
    data: { ...n.data, hasValidationError: errorNodeIds.has(n.id) },
  }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2.5 bg-white">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/settings/demorobot/${robotModelId}/flows`)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-64 font-medium" />
        </div>
        <div className="flex items-center gap-2">
          {validationErrors.length > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {validationErrors.length} error{validationErrors.length === 1 ? "" : "s"}
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save
          </Button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 space-y-0.5">
          {validationErrors.map((e, i) => (
            <div key={i}>{e.message}</div>
          ))}
        </div>
      )}

      <div className="flex-1">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setPanelNodeId(node.id)}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      <FlowNodePanel
        open={panelOpen}
        onOpenChange={(open) => !open && setPanelNodeId(null)}
        nodeId={panelNodeId}
        data={selectedNode ? (selectedNode.data as FlowQuestionNodeData) : null}
        availableAssets={assets}
        attachedAssetIds={attachedAssetIds}
        onChange={handleNodeDataChange}
        onAddAnswer={handleAddAnswer}
        onRemoveAnswer={handleRemoveAnswer}
        onToggleAnswerEscalation={handleToggleAnswerEscalation}
        onToggleAttachment={handleToggleAttachment}
      />
    </div>
  )
}

export function FlowEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  )
}

export default FlowEditorPage
