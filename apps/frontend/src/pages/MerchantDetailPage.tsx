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
import { ImageCropUpload } from "@/components/shared/ImageCropUpload"
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
  // Controlled fields: the live WhatsApp-style preview below re-renders as
  // the operator types. FormData submit still works — inputs keep `name`.
  const [title, setTitle] = useState(item?.title ?? "")
  const [text, setText] = useState(item?.text ?? "")
  const [location, setLocation] = useState(item?.location ?? "")
  const [videoUrl, setVideoUrl] = useState(item?.videoUrl ?? "")
  // New cropped photo as data URI; photoRemoved clears the stored one.
  const [photoBase64, setPhotoBase64] = useState<string>("")
  const [photoRemoved, setPhotoRemoved] = useState(false)
  // The stored photo, only when it actually exists (the endpoint 404s
  // otherwise — probing avoids a broken image in the crop control).
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | undefined>()

  useEffect(() => {
    if (!item) return
    // Absolute URL on purpose: ImageCropUpload prepends IMG_BASE_URL to
    // anything that does not start with "http", which would break this path.
    const url = `${window.location.origin}/api/v1/public/merchant-pushes/${item.id}/photo.jpg`
    const probe = new Image()
    probe.onload = () => setExistingPhotoUrl(url)
    probe.src = url
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCropped = (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Photo is too large — maximum 4MB")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoBase64(String(reader.result || ""))
      setPhotoRemoved(false)
    }
    reader.readAsDataURL(file)
  }

  const previewPhoto =
    photoBase64 || (!photoRemoved ? existingPhotoUrl : undefined)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="text">Text *</Label>
        <Textarea
          id="text"
          name="text"
          required
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          Links must belong to the workspace allowed external links, or saving will be rejected.
        </p>
      </div>

      {/* Photo: same crop control used everywhere else in the app. NEVER pass
          the freshly-cropped data URI as currentImageUrl — the component
          treats non-http values as storage keys and would mangle it; after a
          crop it shows its own internal preview anyway. */}
      <ImageCropUpload
        label="Photo"
        currentImageUrl={photoRemoved ? undefined : existingPhotoUrl}
        onImageSelected={handleCropped}
        onImageRemove={() => {
          setPhotoBase64("")
          setPhotoRemoved(true)
        }}
        size="lg"
      />
      <input type="hidden" name="photoBase64" value={photoBase64} />
      <input type="hidden" name="photoRemove" value={photoRemoved ? "1" : ""} />

      <div className="space-y-2">
        <Label htmlFor="videoUrl">Video URL</Label>
        <Input
          id="videoUrl"
          name="videoUrl"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Leave empty to use the merchant's location"
        />
        <p className="text-xs text-gray-500">
          Empty = the merchant's own location is sent automatically.
        </p>
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

      {/* Live preview — the WhatsApp bubble as customers will see it */}
      <div className="space-y-1 pt-2 border-t">
        <Label>Preview</Label>
        <div className="max-w-sm rounded-xl border border-emerald-200 bg-[#e7ffdb] p-3 space-y-2 shadow-sm">
          {previewPhoto && (
            <img
              src={previewPhoto}
              alt="Push photo"
              className="w-full max-h-44 rounded-lg object-cover"
            />
          )}
          <div className="text-sm text-slate-900 whitespace-pre-wrap">
            <span className="font-bold">{title || "Title"}</span>
            {"\n\n"}
            {text || "Push text…"}
            {(location || "").trim() ? `\n\n📍 ${location}` : "\n\n📍 (merchant's location)"}
            {videoUrl ? `\n\n${videoUrl}` : ""}
          </div>
        </div>
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
    const photoBase64 = (formData.get("photoBase64") as string) || ""
    const photoRemoved = (formData.get("photoRemove") as string) === "1"
    return {
      title: String(formData.get("title") ?? ""),
      text: String(formData.get("text") ?? ""),
      // New photo replaces; explicit remove clears; otherwise the stored
      // photo is untouched.
      ...(photoBase64
        ? { photoBase64 }
        : photoRemoved
          ? { photoBase64: null }
          : {}),
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

        {/* Sending activity — chart + per-campaign breakdown, always
            AGGREGATED: never a per-recipient list (Andrea, 2026-09-01:
            "una lista enorme non aiuta"). These are the invoice numbers. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Sending activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {stats.monthlySent.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nothing sent yet — the chart and the monthly breakdown appear
                after the first campaign run.
              </p>
            ) : (
              <>
                {/* Single-series bar chart: sent per month. One hue, thin
                    bars, rounded data-end, direct labels, recessive axis. */}
                <div>
                  <div className="flex items-end gap-2 h-36 pt-2">
                    {[...stats.monthlySent].reverse().map((m) => {
                      const maxSent = Math.max(...stats.monthlySent.map((x) => x.sent), 1)
                      return (
                        <div
                          key={m.month}
                          className="flex-1 max-w-16 flex flex-col items-center justify-end gap-1 h-full"
                          title={`${m.month}: ${m.sent} sent`}
                        >
                          <span className="text-[11px] font-semibold text-slate-700">
                            {m.sent}
                          </span>
                          <div
                            className="w-full max-w-9 rounded-t-[4px] bg-emerald-500"
                            style={{
                              height: `${Math.max((m.sent / maxSent) * 100, 3)}%`,
                            }}
                          />
                          <span className="text-[10px] text-slate-500">
                            {m.month.slice(5, 7)}/{m.month.slice(2, 4)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="h-px bg-slate-200 mt-0" />
                </div>

                {/* Month → campaigns drill-down. Months are few, campaigns per
                    month fewer: everything readable without expanding. */}
                <div className="space-y-3">
                  {stats.monthlySent.map((m) => (
                    <div key={m.month}>
                      <div className="flex items-baseline justify-between border-b pb-1">
                        <span className="text-sm font-semibold text-slate-900">{m.month}</span>
                        <span className="text-sm font-bold text-slate-900">{m.sent} sent</span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {m.campaigns.map((c) => (
                          <li
                            key={c.campaignId}
                            className="flex items-baseline justify-between text-xs text-slate-600 pl-3"
                          >
                            <span className="truncate">
                              {c.name}
                              {c.pushTitle ? ` · ${c.pushTitle}` : ""}
                            </span>
                            <span className="font-medium shrink-0 pl-2">{c.sent}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
            {stats.topups.length > 0 && (
              <div className="pt-4 border-t">
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
                    {/* Thumbnail from the public photo endpoint; hides itself
                        when the push has no uploaded photo (404). */}
                    <img
                      src={`/api/v1/public/merchant-pushes/${p.id}/photo.jpg`}
                      alt=""
                      className="w-14 h-14 rounded-md border object-cover shrink-0"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
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
