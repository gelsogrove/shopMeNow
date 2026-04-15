import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FlowConfigSheet } from "@/components/shared/FlowConfigSheet"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { flowConfigApi, FlowConfig } from "@/services/flowConfigApi"
import { Pencil, Plus, Trash2, Workflow } from "lucide-react"
import { useEffect, useState } from "react"

export function FlowConfigsPage() {
  const { workspace } = useWorkspace()
  const [configs, setConfigs] = useState<FlowConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<FlowConfig | null>(null)

  const loadConfigs = async () => {
    if (!workspace?.id) return
    try {
      setIsLoading(true)
      const data = await flowConfigApi.getAllForWorkspace(workspace.id)
      setConfigs(data)
    } catch (error) {
      logger.error("Error loading flow configs:", error)
      toast.error("Failed to load flow configs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadConfigs()
  }, [workspace?.id])

  const handleEdit = (config: FlowConfig) => {
    setSelectedConfig(config)
    setShowEditSheet(true)
  }

  const handleDeleteClick = (config: FlowConfig) => {
    setSelectedConfig(config)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedConfig || !workspace?.id) return
    try {
      await flowConfigApi.remove(workspace.id, selectedConfig.id)
      setConfigs((prev) => prev.filter((c) => c.id !== selectedConfig.id))
      toast.success("Flow config deleted successfully")
    } catch (error: any) {
      logger.error("Error deleting flow config:", error)
      toast.error(error.message || "Failed to delete flow config")
    } finally {
      setShowDeleteDialog(false)
      setSelectedConfig(null)
    }
  }

  const getFlowsCount = (config: FlowConfig): number => {
    if (!config.flows || typeof config.flows !== "object") return 0
    return Object.keys(config.flows).length
  }

  return (
    <PageLayout>
      <div className="container pl-0 pr-4 pt-4 pb-4">
        <div className="grid grid-cols-12 gap-0">
          <div className="col-span-11 col-start-1">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Workflow className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Flow Configs
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Manage guided troubleshooting flows for your chatbot.
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowAddSheet(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Flow Config
              </Button>
            </div>

            {/* Table */}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : configs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Workflow className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No flow configs yet</p>
                <p className="text-sm">
                  Create your first flow config to enable guided troubleshooting.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Flow Key</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Flows</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">
                        {config.flowLabel}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {config.flowKey}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {config.model || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getFlowsCount(config)} steps
                      </TableCell>
                      <TableCell>
                        {config.isActive ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(config.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(config)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(config)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Add Sheet */}
      <FlowConfigSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        workspaceId={workspace?.id || ""}
        config={null}
        onSaved={loadConfigs}
      />

      {/* Edit Sheet */}
      <FlowConfigSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        workspaceId={workspace?.id || ""}
        config={selectedConfig}
        onSaved={loadConfigs}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Flow Config"
        description={`Are you sure you want to delete "${selectedConfig?.flowLabel}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Delete"
        variant="destructive"
      />
    </PageLayout>
  )
}
