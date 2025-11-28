import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useWorkspace } from "@/hooks/use-workspace"
import { logger } from "@/lib/logger"
import { salesApi, type Sales } from "@/services/salesApi"
import { UserCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export default function SalesPage() {
  const { workspace } = useWorkspace()
  const [sales, setSales] = useState<Sales[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSales, setSelectedSales] = useState<Sales | null>(null)
  const [hasAssociatedCustomers, setHasAssociatedCustomers] = useState(false)

  useEffect(() => {
    if (workspace?.id) {
      loadSales()
    }
  }, [workspace?.id])

  const loadSales = async () => {
    if (!workspace?.id) return

    try {
      setLoading(true)
      const response = await salesApi.getAllForWorkspace(workspace.id)
      setSales(response || [])
    } catch (error) {
      logger.error("Error loading sales:", error)
      toast.error("Failed to load sales")
    } finally {
      setLoading(false)
    }
  }

  const filteredSales = sales.filter((sale) =>
    Object.values(sale).some((value) =>
      value?.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const columns = [
    {
      header: "First Name",
      accessorKey: "firstName" as keyof Sales,
      size: 150,
    },
    { header: "Last Name", accessorKey: "lastName" as keyof Sales, size: 150 },
    { header: "Email", accessorKey: "email" as keyof Sales, size: 250 },
    { header: "Phone", accessorKey: "phone" as keyof Sales, size: 150 },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string

    if (!firstName || !lastName || !email) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      await salesApi.create(workspace.id, {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        isActive: true,
      })

      toast.success("Salesperson added successfully")
      setShowAddSheet(false)
      await loadSales()
    } catch (error) {
      logger.error("Error adding salesperson:", error)
      toast.error("Failed to add salesperson")
    }
  }

  const handleEdit = (sale: Sales) => {
    setSelectedSales(sale)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSales?.id || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string

    if (!firstName || !lastName || !email) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      await salesApi.update(selectedSales.id, workspace.id, {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
      })

      toast.success("Salesperson updated successfully")
      setShowEditSheet(false)
      setSelectedSales(null)
      await loadSales()
    } catch (error) {
      logger.error("Error updating salesperson:", error)
      toast.error("Failed to update salesperson")
    }
  }

  const handleDelete = async (sale: Sales) => {
    setSelectedSales(sale)

    if (!workspace?.id) return

    try {
      // Check if the salesperson has associated customers
      const hasCustomers = await salesApi.hasCustomers(sale.id, workspace.id)
      setHasAssociatedCustomers(hasCustomers)
      setShowDeleteDialog(true)
    } catch (error) {
      logger.error("Error checking if salesperson has customers:", error)
      toast.error("Failed to check salesperson customers")
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedSales?.id || !workspace?.id) return

    // If the salesperson has associated customers, we don't allow deletion
    if (hasAssociatedCustomers) {
      setShowDeleteDialog(false)
      toast.error(
        "Cannot delete this salesperson as they have associated customers. Please unassign all customers from this salesperson first."
      )
      return
    }

    try {
      await salesApi.delete(selectedSales.id, workspace.id)
      toast.success("Salesperson deleted successfully")
      setShowDeleteDialog(false)
      setSelectedSales(null)
      await loadSales()
    } catch (error) {
      logger.error("Error deleting salesperson:", error)
      toast.error("Failed to delete salesperson")
    }
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-2">
          <LoadingSpinner />
          <p className="text-lg font-medium">Loading sales...</p>
        </div>
      </div>
    )
  }

  const renderForm = (sale: Sales | null = null) => (
    <form
      onSubmit={sale ? handleEditSubmit : handleAdd}
      className="space-y-6 pt-6"
    >
      <div className="space-y-2">
        <Label htmlFor="firstName">First Name</Label>
        <Input
          id="firstName"
          name="firstName"
          defaultValue={sale?.firstName}
          placeholder="First name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Last Name</Label>
        <Input
          id="lastName"
          name="lastName"
          defaultValue={sale?.lastName}
          placeholder="Last name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={sale?.email}
          placeholder="email@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={sale?.phone}
          placeholder="+1234567890"
        />
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          {sale ? "Save Changes" : "Add"}
        </Button>
      </div>
    </form>
  )

  return (
    <div className="container pl-0 pr-4 pt-4 pb-4">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-11 col-start-1">
          <PageHeader
            title="Sales"
            titleIcon={<UserCircle className="mr-2 h-6 w-6 text-green-500" />}
            searchValue={searchValue}
            onSearch={setSearchValue}
            searchPlaceholder="Search sales..."
            itemCount={filteredSales.length}
            onAdd={() => setShowAddSheet(true)}
            addButtonText="Add"
          />

          <div className="mt-6 w-full">
            <DataTable
              columns={columns}
              data={filteredSales}
              onEdit={handleEdit}
              onDelete={handleDelete}
              globalFilter={searchValue}
            />
          </div>
        </div>
      </div>

      {/* Add Salesperson Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Add</SheetTitle>
            <SheetDescription>
              Add a new salesperson to your workspace
            </SheetDescription>
          </SheetHeader>
          {renderForm()}
        </SheetContent>
      </Sheet>

      {/* Edit Salesperson Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="right" className="w-[25%]">
          <SheetHeader>
            <SheetTitle>Edit Salesperson</SheetTitle>
            <SheetDescription>
              Make changes to your salesperson here
            </SheetDescription>
          </SheetHeader>
          {selectedSales && renderForm(selectedSales)}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={
          hasAssociatedCustomers
            ? "Cannot Delete Salesperson"
            : "Delete Salesperson"
        }
        description={
          hasAssociatedCustomers
            ? `The salesperson "${selectedSales?.firstName} ${selectedSales?.lastName}" has customers associated with them.\nYou need to unassign all customers from this salesperson before deleting.`
            : `Are you sure you want to delete ${selectedSales?.firstName} ${selectedSales?.lastName}? This action cannot be undone.`
        }
        onConfirm={handleDeleteConfirm}
        confirmLabel={hasAssociatedCustomers ? "Understood" : "Delete"}
        variant={hasAssociatedCustomers ? "secondary" : "destructive"}
      />
    </div>
  )
}
