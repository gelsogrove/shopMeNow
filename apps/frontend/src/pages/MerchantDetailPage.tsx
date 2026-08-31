import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { ArrowLeft, Coins, ImageIcon, Plus, Video } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "../lib/toast"
import {
  MerchantPush,
  MerchantStats,
  merchantApi,
} from "@/services/merchantApi"

/**
 * Per-merchant view: the creatives (pushes) the merchant provided, the push
 * package balance with its top-up history, and the monthly sent report — the
 * exact numbers the owner (Pro Loco) invoices on. Quantities only: prices
 * live outside the system by design (Andrea, 2026-08-31).
 */

function PushFormFields({ item }: { item: MerchantPush | null }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" name="title" required defaultValue={item?.title ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="text">Text *</Label>
        <Textarea id="text" name="text" required rows={4} defaultValue={item?.text ?? ""} />
        <p className="text-xs text-gray-500">
          Links must belong to the workspace allowed external links, or saving will be rejected.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="photoUrl">Photo URL</Label>
        <Input id="photoUrl" name="photoUrl" defaultValue={item?.photoUrl ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="videoUrl">Video URL</Label>
        <Input id="videoUrl" name="videoUrl" defaultValue={item?.videoUrl ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={item?.location ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Internal notes</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={item?.description ?? ""}
        />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <input
          id="isActive"
          name="isActive"
          type="checkbox"
          defaultChecked={item ? item.isActive : true}
          className="h-4 w-4"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}

export function MerchantDetailPage() {
  const navigate = useNavigate()
  const { merchantId } = useParams<{ merchantId: string }>()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [stats, setStats] = useState<MerchantStats | null>(null)
  const [pushes, setPushes] = useState<MerchantPush[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedPush, setSelectedPush] = useState<MerchantPush | null>(null)
  const [topupAmount, setTopupAmount] = useState("")
  const [topupNote, setTopupNote] = useState("")
  const [isToppingUp, setIsToppingUp] = useState(false)

  const load = async () => {
    if (!workspace?.id || !merchantId) return
    try {
      const [statsData, pushesData] = await Promise.all([
        merchantApi.getStats(workspace.id, merchantId),
        merchantApi.getPushes(workspace.id, merchantId),
      ])
      setStats(statsData)
      setPushes(pushesData)
    } catch (error) {
      logger.error("Error loading merchant detail:", error)
      toast.error("Failed to load merchant")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, merchantId, isLoadingWorkspace])

  const readPushForm = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    const optional = (key: string) => (formData.get(key) as string) || null
    return {
      title: String(formData.get("title") ?? ""),
      text: String(formData.get("text") ?? ""),
      photoUrl: optional("photoUrl"),
      videoUrl: optional("videoUrl"),
      location: optional("location"),
      description: optional("description"),
      isActive: formData.get("isActive") === "on",
    }
  }

  const handleAddPush = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id || !merchantId) return
    try {
      const created = await merchantApi.createPush(
        workspace.id,
        merchantId,
        readPushForm(e.target as HTMLFormElement)
      )
      setPushes([created, ...pushes])
      setShowAddSheet(false)
      toast.success("Push created")
    } catch (error: any) {
      logger.error("Error creating push:", error)
      // Surface the backend's actionable message (e.g. unauthorized links)
      toast.error(error?.response?.data?.error || "Failed to create push")
    }
  }

  const handleEditPush = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id || !merchantId || !selectedPush) return
    try {
      const updated = await merchantApi.updatePush(
        workspace.id,
        merchantId,
        selectedPush.id,
        readPushForm(e.target as HTMLFormElement)
      )
      setPushes(pushes.map((p) => (p.id === selectedPush.id ? updated : p)))
      setShowEditSheet(false)
      setSelectedPush(null)
      toast.success("Push updated")
    } catch (error: any) {
      logger.error("Error updating push:", error)
      toast.error(error?.response?.data?.error || "Failed to update push")
    }
  }

  const handleDeletePush = async () => {
    if (!workspace?.id || !merchantId || !selectedPush) return
    try {
      await merchantApi.deletePush(workspace.id, merchantId, selectedPush.id)
      setPushes(pushes.filter((p) => p.id !== selectedPush.id))
      setShowDeleteDialog(false)
      setSelectedPush(null)
      toast.success("Push deleted")
    } catch (error) {
      logger.error("Error deleting push:", error)
      toast.error("Failed to delete push")
    }
  }

  const handleTopup = async () => {
    if (!workspace?.id || !merchantId) return
    const amount = Number(topupAmount)
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Amount must be a positive whole number")
      return
    }
    setIsToppingUp(true)
    try {
      await merchantApi.topUpQuota(workspace.id, merchantId, amount, topupNote || undefined)
      setTopupAmount("")
      setTopupNote("")
      toast.success(`Added ${amount} pushes to the package`)
      await load() // refresh balance + topup history together
    } catch (error: any) {
      logger.error("Error topping up:", error)
      toast.error(error?.response?.data?.error || "Failed to top up")
    } finally {
      setIsToppingUp(false)
    }
  }

  if (!workspace?.id) {
    return (
      <PageLayout>
        <div>No workspace selected</div>
      </PageLayout>
    )
  }
  if (isLoading || !stats) {
    return (
      <PageLayout>
        <div className="text-center py-12">Loading...</div>
      </PageLayout>
    )
  }

  const quotaPct =
    stats.totalPurchased > 0
      ? Math.round((stats.quotaRemaining / stats.totalPurchased) * 100)
      : 0

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/merchants")}
            className="text-green-700 hover:text-green-800 hover:bg-green-50"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Merchants
          </Button>
        </div>

        {/* Package balance — the number the owner checks before saying yes to a campaign */}
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-white">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-600" />
                {stats.name}
                <Badge
                  variant={stats.isActive ? "default" : "secondary"}
                  className={stats.isActive ? "bg-green-100 text-green-800" : ""}
                >
                  {stats.isActive ? "Active" : "Inactive"}
                </Badge>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {stats.quotaRemaining}
                </span>
                <span className="text-sm text-gray-500">
                  pushes remaining of {stats.totalPurchased} purchased · {stats.totalSent} sent
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, quotaPct)}%` }}
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="topup-amount">Sell package</Label>
                <Input
                  id="topup-amount"
                  type="number"
                  min={1}
                  placeholder="e.g. 500"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label htmlFor="topup-note">Note</Label>
                <Input
                  id="topup-note"
                  placeholder="e.g. Winter package"
                  value={topupNote}
                  onChange={(e) => setTopupNote(e.target.value)}
                />
              </div>
              <Button
                onClick={handleTopup}
                disabled={isToppingUp}
                className="bg-green-600 hover:bg-green-700"
              >
                Add pushes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Monthly report — what the owner invoices on */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Monthly sent report</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.monthlySent.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing sent yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 font-medium">Month</th>
                    <th className="py-2 font-medium text-right">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.monthlySent.map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2">{row.month}</td>
                      <td className="py-2 text-right font-semibold">{row.sent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {stats.topups.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-gray-500 mb-2">Package purchases</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {stats.topups.map((t) => (
                    <li key={t.id}>
                      +{t.amount} · {new Date(t.createdAt).toLocaleDateString()}
                      {t.note ? ` · ${t.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creatives */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Pushes <span className="text-sm font-normal text-gray-500">({pushes.length})</span>
              </CardTitle>
              <Button
                onClick={() => setShowAddSheet(true)}
                className="bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Push
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pushes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No creatives yet. Add the first push to link it to a campaign.
              </p>
            ) : (
              <div className="divide-y">
                {pushes.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{p.title}</span>
                        <Badge
                          variant={p.isActive ? "default" : "secondary"}
                          className={p.isActive ? "bg-green-100 text-green-800" : ""}
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {p.photoUrl && <ImageIcon className="w-3.5 h-3.5 text-gray-400" />}
                        {p.videoUrl && <Video className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">
                        {p.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPush(p)
                          setShowEditSheet(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setSelectedPush(p)
                          setShowDeleteDialog(true)
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add Push"
        description="A reusable creative. Campaigns snapshot its content when linked."
        onSubmit={handleAddPush}
      >
        <PushFormFields item={null} />
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Push"
        description="Editing never changes campaigns that already snapshotted this creative."
        onSubmit={handleEditPush}
      >
        {selectedPush && <PushFormFields item={selectedPush} />}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Push"
        description={`Delete "${selectedPush?.title}"? Campaigns that snapshotted it keep their content.`}
        onConfirm={handleDeletePush}
      />
    </PageLayout>
  )
}
