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
import { ArrowLeft, Megaphone, Plus, Store } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "../lib/toast"
import { Merchant, merchantApi } from "@/services/merchantApi"

/**
 * Merchants (esercenti) — the resale side of push campaigns: the workspace
 * owner (e.g. a Pro Loco) sells push packages to local businesses. This page
 * manages the registry: identity, invoicing data, active state, and the
 * always-visible package balance the owner checks before approving a new
 * campaign. Details (creatives, quota history, monthly report) live in the
 * per-merchant page.
 */

/** Shared by Add and Edit sheets; values read back via FormData. */
function MerchantFormFields({ item }: { item: Merchant | null }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" required defaultValue={item?.name ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={item?.location ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={item?.description ?? ""}
        />
      </div>

      <div className="pt-2 border-t">
        <p className="text-sm font-semibold text-gray-700 mb-3">Billing data</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="billingName">Business name</Label>
            <Input id="billingName" name="billingName" defaultValue={item?.billingName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vatNumber">VAT number</Label>
            <Input id="vatNumber" name="vatNumber" defaultValue={item?.vatNumber ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxCode">Tax code</Label>
            <Input id="taxCode" name="taxCode" defaultValue={item?.taxCode ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sdiCode">SDI code</Label>
            <Input id="sdiCode" name="sdiCode" defaultValue={item?.sdiCode ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pec">PEC</Label>
            <Input id="pec" name="pec" type="email" defaultValue={item?.pec ?? ""} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="billingAddress">Address</Label>
            <Input id="billingAddress" name="billingAddress" defaultValue={item?.billingAddress ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingCity">City</Label>
            <Input id="billingCity" name="billingCity" defaultValue={item?.billingCity ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingZip">ZIP</Label>
            <Input id="billingZip" name="billingZip" defaultValue={item?.billingZip ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingProvince">Province</Label>
            <Input id="billingProvince" name="billingProvince" defaultValue={item?.billingProvince ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingCountry">Country</Label>
            <Input id="billingCountry" name="billingCountry" defaultValue={item?.billingCountry ?? "IT"} />
          </div>
        </div>
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

export function MerchantsPage() {
  const navigate = useNavigate()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Merchant | null>(null)

  const loadMerchants = async () => {
    if (!workspace?.id) return
    try {
      setMerchants(await merchantApi.getMerchants(workspace.id))
    } catch (error) {
      logger.error("Error loading merchants:", error)
      toast.error("Failed to load merchants")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) loadMerchants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  const readFormData = (form: HTMLFormElement) => {
    const formData = new FormData(form)
    const optional = (key: string) => (formData.get(key) as string) || null
    return {
      name: String(formData.get("name") ?? ""),
      location: optional("location"),
      description: optional("description"),
      billingName: optional("billingName"),
      vatNumber: optional("vatNumber"),
      taxCode: optional("taxCode"),
      sdiCode: optional("sdiCode"),
      pec: optional("pec"),
      billingAddress: optional("billingAddress"),
      billingCity: optional("billingCity"),
      billingZip: optional("billingZip"),
      billingProvince: optional("billingProvince"),
      billingCountry: optional("billingCountry"),
      isActive: formData.get("isActive") === "on",
    }
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return
    try {
      const created = await merchantApi.createMerchant(
        workspace.id,
        readFormData(e.target as HTMLFormElement)
      )
      setMerchants([...merchants, created].sort((a, b) => a.name.localeCompare(b.name)))
      setShowAddSheet(false)
      toast.success("Merchant created")
    } catch (error: any) {
      logger.error("Error creating merchant:", error)
      toast.error(error?.response?.data?.error || "Failed to create merchant")
    }
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedItem || !workspace?.id) return
    try {
      const updated = await merchantApi.updateMerchant(
        workspace.id,
        selectedItem.id,
        readFormData(e.target as HTMLFormElement)
      )
      setMerchants(merchants.map((m) => (m.id === selectedItem.id ? updated : m)))
      setShowEditSheet(false)
      setSelectedItem(null)
      toast.success("Merchant updated")
    } catch (error: any) {
      logger.error("Error updating merchant:", error)
      toast.error(error?.response?.data?.error || "Failed to update merchant")
    }
  }

  const handleToggleActive = async (item: Merchant) => {
    if (!workspace?.id) return
    try {
      const updated = await merchantApi.updateMerchant(workspace.id, item.id, {
        name: item.name,
        isActive: !item.isActive,
      })
      setMerchants(merchants.map((m) => (m.id === item.id ? updated : m)))
      toast.success(updated.isActive ? "Merchant activated" : "Merchant deactivated")
    } catch (error) {
      logger.error("Error toggling merchant:", error)
      toast.error("Failed to update merchant")
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedItem || !workspace?.id) return
    try {
      await merchantApi.deleteMerchant(workspace.id, selectedItem.id)
      setMerchants(merchants.filter((m) => m.id !== selectedItem.id))
      setShowDeleteDialog(false)
      setSelectedItem(null)
      toast.success("Merchant deleted")
    } catch (error) {
      logger.error("Error deleting merchant:", error)
      toast.error("Failed to delete merchant")
    }
  }

  if (!workspace?.id) {
    return (
      <PageLayout>
        <div>No workspace selected</div>
      </PageLayout>
    )
  }
  if (isLoading) {
    return (
      <PageLayout>
        <div className="text-center py-12">Loading...</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/campaigns")}
            className="text-green-700 hover:text-green-800 hover:bg-green-50"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Campaigns
          </Button>
        </div>

        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Store className="h-5 w-5 text-emerald-600" />
                Merchants
                <span className="text-sm font-normal text-gray-500">
                  ({merchants.length})
                </span>
              </CardTitle>
              <Button
                onClick={() => setShowAddSheet(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Merchant
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {merchants.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No merchants yet. Add the first local business to start selling push packages.
              </p>
            ) : (
              <div className="divide-y">
                {merchants.map((m) => (
                  <div key={m.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">{m.name}</span>
                        <Badge
                          variant={m.isActive ? "default" : "secondary"}
                          className={m.isActive ? "bg-green-100 text-green-800" : ""}
                        >
                          {m.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {m.location && (
                        <p className="text-xs text-gray-500 truncate">{m.location}</p>
                      )}
                    </div>
                    {/* The number the owner checks before approving a campaign */}
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-900">
                        {m.quotaRemaining}
                      </div>
                      <div className="text-[11px] text-gray-500">push left</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/merchants/${m.id}`)}
                      >
                        <Megaphone className="w-3.5 h-3.5 mr-1.5" />
                        Pushes & Quota
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedItem(m)
                          setShowEditSheet(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggleActive(m)}>
                        {m.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setSelectedItem(m)
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
        title="Add Merchant"
        description="Register a local business that buys push packages."
        onSubmit={handleAdd}
      >
        <MerchantFormFields item={null} />
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit Merchant"
        description="Update the merchant's identity and billing data."
        onSubmit={handleEditSubmit}
      >
        {selectedItem && <MerchantFormFields item={selectedItem} />}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Merchant"
        description={`Are you sure you want to delete "${selectedItem?.name}"? Send history is kept for invoicing.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
