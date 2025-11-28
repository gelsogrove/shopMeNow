import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { CrudPageContent } from "@/components/shared/CrudPageContent"
import { FormSheet } from "@/components/shared/FormSheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkspace } from "@/hooks/use-workspace"
import { FAQ, faqApi } from "@/services/faqApi"
import { commonStyles } from "@/styles/common"
import { HelpCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export function FAQPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null)

  const loadFAQs = async () => {
    if (!workspace?.id) return
    try {
      const data = await faqApi.getFAQs(workspace.id)
      setFaqs(data)
    } catch (error) {
      logger.error("Error loading FAQs:", error)
      toast.error("Failed to load FAQs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoadingWorkspace) {
      loadFAQs()
    }
  }, [workspace?.id, isLoadingWorkspace])

  const filteredFAQs = faqs.filter((faq) =>
    Object.values(faq).some((value) =>
      value.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  const columns = [
    { header: "Question", accessorKey: "question" as keyof FAQ, size: 300 },
    {
      header: "Answer",
      accessorKey: "answer" as keyof FAQ,
      size: 700, // Increased from 400 to 700 for a longer column
      cell: ({ row }: { row: { original: FAQ } }) => {
        const answer = row.original.answer
        const maxLength = 200 // Increased from 80 to 200
        const isTruncated = answer.length > maxLength

        return (
          <div>
            {isTruncated ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      {answer.substring(0, maxLength)}...
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-2xl p-4 text-sm">
                    {" "}
                    {/* Increased max width */}
                    <p>{answer}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              answer
            )}
          </div>
        )
      },
    },
    {
      header: "Status",
      accessorKey: "isActive" as keyof FAQ,
      size: 100,
      cell: ({ row }: { row: { original: FAQ } }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            row.original.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ]

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const data = {
      question: formData.get("question") as string,
      answer: formData.get("answer") as string,
      isActive: formData.get("isActive") === "on",
    }

    try {
      const newFAQ = await faqApi.createFAQ(workspace.id, data)
      setFaqs([...faqs, newFAQ])
      setShowAddSheet(false)
      toast.success("FAQ created successfully")
    } catch (error) {
      logger.error("Error creating FAQ:", error)
      toast.error("Failed to create FAQ")
    }
  }

  const handleEdit = (faq: FAQ) => {
    setSelectedFAQ(faq)
    setShowEditSheet(true)
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFAQ || !workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const data = {
      question: formData.get("question") as string,
      answer: formData.get("answer") as string,
      isActive: formData.get("isActive") === "on",
    }

    try {
      const updatedFAQ = await faqApi.updateFAQ(
        workspace.id,
        selectedFAQ.id,
        data
      )
      setFaqs(faqs.map((f) => (f.id === selectedFAQ.id ? updatedFAQ : f)))
      setShowEditSheet(false)
      setSelectedFAQ(null)
      toast.success("FAQ updated successfully")
    } catch (error) {
      logger.error("Error updating FAQ:", error)
      toast.error("Failed to update FAQ")
    }
  }

  const handleDelete = (faq: FAQ) => {
    setSelectedFAQ(faq)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedFAQ || !workspace?.id) return

    try {
      await faqApi.deleteFAQ(workspace.id, selectedFAQ.id)
      setFaqs(faqs.filter((f) => f.id !== selectedFAQ.id))
      setShowDeleteDialog(false)
      setSelectedFAQ(null)
      toast.success("FAQ deleted successfully")
    } catch (error) {
      logger.error("Error deleting FAQ:", error)
      toast.error("Failed to delete FAQ")
    }
  }

  if (isLoadingWorkspace || isLoading) {
    return <div>Loading...</div>
  }

  if (!workspace?.id) {
    return <div>No workspace selected</div>
  }

  const renderFormFields = (faq: FAQ | null) => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="question">Question</Label>
        <Input
          id="question"
          name="question"
          placeholder="Enter question"
          defaultValue={faq?.question}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="answer">Answer</Label>
        <Textarea
          id="answer"
          name="answer"
          className="min-h-[150px]"
          placeholder="Enter detailed answer"
          defaultValue={faq?.answer}
          required
        />
        <p className="text-xs text-gray-500">
          Provide a clear and detailed answer to the question.
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          name="isActive"
          defaultChecked={faq ? faq.isActive : true}
        />
        <Label htmlFor="isActive">Active</Label>
        <p className="text-xs text-gray-500 ml-2">
          Only active FAQs will be visible to customers
        </p>
      </div>
    </div>
  )

  return (
    <PageLayout>
      <CrudPageContent
        title="FAQ"
        titleIcon={<HelpCircle className={commonStyles.headerIcon} />}
        searchValue={searchValue}
        onSearch={setSearchValue}
        searchPlaceholder="Search FAQs..."
        onAdd={() => setShowAddSheet(true)}
        addButtonText="Add"
        data={filteredFAQs}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
      />

      <FormSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        title="Add FAQ"
        description="Add a new frequently asked question"
        onSubmit={handleAdd}
      >
        {renderFormFields(null)}
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit FAQ"
        description="Edit this frequently asked question"
        onSubmit={handleEditSubmit}
      >
        {selectedFAQ && renderFormFields(selectedFAQ)}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete FAQ"
        description={`Are you sure you want to delete the FAQ "${selectedFAQ?.question}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </PageLayout>
  )
}
