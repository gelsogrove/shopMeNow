import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { flowConfigApi, FlowConfig } from "@/services/flowConfigApi"
import { Pencil, Plus, QrCode, Trash2, Workflow } from "lucide-react"
import { useEffect, useState } from "react"
import { FlowConfigSheet } from "@/components/shared/FlowConfigSheet"
import { FlowQRDialog } from "@/components/shared/FlowQRDialog"
import { PageLayout } from "@/components/layout/PageLayout"

export function FlowConfigsPage() {
  const { workspace } = useWorkspace()
  const [configs, setConfigs] = useState<FlowConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<FlowConfig | null>(null)

  const loadConfigs = async () => {
    if (!workspace?.id) return
    try {
      setIsLoading(true)
      const data = await flowConfigApi.getAllForWorkspace(workspace.id)
      setConfigs(data)
    } catch (error) {
      logger.error("Failed to load flow configs:", error)
      toast.error("Failed to load flow configs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [workspace?.id])

  const handleDeleteClick = (config: FlowConfig) => {
    setSelectedConfig(config)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedConfig || !workspace?.id) return
    try {
      await flowConfigApi.remove(workspace.id, selectedConfig.id)
      toast.success("Flow config deleted")
      setShowDeleteDialog(false)
      setSelectedConfig(null)
      await loadConfigs()
    } catch (error) {
      logger.error("Failed to delete flow config:", error)
      toast.error("Failed to delete flow config")
    }
  }

  const getFlowsCount = (config: FlowConfig) => {
    if (!config.flows || typeof config.flows !== "object") return 0
    return Object.keys(config.flows).length
  }

  return (
    <PageLayout title="Flow Configs" icon={<Workflow className="h-5 w-5" />}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flow Configs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage flow machine configurations for this workspace
          </p>
        </div>
        <Button onClick={() => setShowAddSheet(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Flow Config
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : configs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Workflow className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No flow configs yet. Click "Add Flow Config" to create one.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Flow Key</TableHead>
              <TableHead>Flows</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.map((config) => (
              <TableRow key={config.id}>
                <TableCell className="font-medium">{config.flowLabel}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {config.flowKey}
                  </code>
                </TableCell>
                <TableCell>{getFlowsCount(config)} nodes</TableCell>
                <TableCell>
                  <Badge variant={config.isActive ? "default" : "secondary"}>
                    {config.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="QR Code"
                      onClick={() => {
                        setSelectedConfig(config)
                        setShowQRDialog(true)
                      }}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={() => {
                        setSelectedConfig(config)
                        setShowEditSheet(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => handleDeleteClick(config)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Sheet */}
      <FlowConfigSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        workspaceId={workspace?.id || ""}
        onSaved={loadConfigs}
      />

      {/* Edit Sheet */}
      {selectedConfig && (
        <FlowConfigSheet
          open={showEditSheet}
          onOpenChange={(open) => {
            setShowEditSheet(open)
            if (!open) setSelectedConfig(null)
          }}
          workspaceId={workspace?.id || ""}
          config={selectedConfig}
          onSaved={loadConfigs}
        />
      )}

      {/* QR Dialog */}
      {selectedConfig && (
        <FlowQRDialog
          open={showQRDialog}
          onOpenChange={(open) => {
            setShowQRDialog(open)
            if (!open) setSelectedConfig(null)
          }}
          flowKey={selectedConfig.flowKey}
          flowLabel={selectedConfig.flowLabel}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flow Config</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedConfig?.flowLabel}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
