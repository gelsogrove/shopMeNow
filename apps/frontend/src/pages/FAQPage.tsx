import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { FAQ, faqApi } from "@/services/faqApi"
import { commonStyles } from "@/styles/common"
import { HelpCircle, Edit2, Trash2, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"

export function FAQPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchValue, setSearchValue] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null)

  const ITEMS_PER_PAGE = 10

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
    faq.question.toLowerCase().includes(searchValue.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchValue.toLowerCase())
  )

  // Pagination
  const totalPages = Math.ceil(filteredFAQs.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedFAQs = filteredFAQs.slice(startIndex, endIndex)

  // Reset to page 1 when searching
  const handleSearch = (value: string) => {
    setSearchValue(value)
    setCurrentPage(1)
  }

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

  if (!workspace?.id) {
    return <PageLayout><div>No workspace selected</div></PageLayout>
  }

  if (isLoading) {
    return <PageLayout><div className="text-center py-12">Loading FAQs...</div></PageLayout>
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
          className="min-h-[400px]"
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HelpCircle className={commonStyles.headerIcon} />
            <h1 className="text-2xl font-bold text-gray-900">FAQ</h1>
            <span className="text-sm text-gray-500">({filteredFAQs.length} items)</span>
          </div>
          <Button onClick={() => setShowAddSheet(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add FAQ
          </Button>
        </div>

        {/* Search */}
        <div>
          <Input
            placeholder="Search FAQs..."
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        {/* Cards Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading FAQs...</div>
        ) : filteredFAQs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No FAQs found. Create one to get started!
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
            {paginatedFAQs.map((faq) => (
              <Card key={faq.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Question */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 hover:line-clamp-none cursor-pointer">
                      {faq.question}
                    </h3>
                    {/* Answer Preview/Full */}
                    <p className="text-sm text-gray-700 mb-3 line-clamp-3 whitespace-pre-wrap">
                      {faq.answer}
                    </p>
                  </div>

                  {/* Right Side: Status + Actions */}
                  <div className="flex gap-4 flex-shrink-0 items-center">
                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        faq.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {faq.isActive ? "Active" : "Inactive"}
                    </span>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(faq)}
                        className="hover:bg-green-50 text-green-600 hover:text-green-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(faq)}
                        className="hover:bg-red-50 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <p className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredFAQs.length)} of {filteredFAQs.length} FAQs
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
