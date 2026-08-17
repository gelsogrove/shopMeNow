import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { FormSheet } from "@/components/shared/FormSheet"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateWorkspace } from "@/services/workspaceApi"
import { useWorkspace } from "@/hooks/use-workspace"
import { FAQ, faqApi } from "@/services/faqApi"
import { commonStyles } from "@/styles/common"
import { ArrowLeft, HelpCircle, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "../lib/toast"
import { ChatWidget } from "@/components/ChatWidget"
import { resolveLogoUrl } from "@/config"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import {
  FaqCategoryFolders,
  FaqCategoryRow,
} from "@/components/faq/FaqCategoryFolders"
import { FaqCardList } from "@/components/faq/FaqCardList"
import { FaqFormFields } from "@/components/faq/FaqFormFields"

// FAQs without a category have no real category value, so they never appear
// inside a named folder. This synthetic id backs an "Uncategorized" row —
// same pattern as the Flow categories page — that is not a real category:
// no rename/delete, just an entry point to those FAQs.
const UNCATEGORIZED_ID = "__uncategorized__"

export function FAQPage() {
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null)
  // Folder navigation, like the Flow categories page: null shows the list of
  // category folders; a category name (or UNCATEGORIZED_ID) shows its FAQs.
  const [openCategory, setOpenCategory] = useState<string | null>(null)
  // Master switch, persisted on the workspace. Saved immediately on toggle —
  // this page has no Save button, unlike the Settings sections.
  const [faqsEnabled, setFaqsEnabled] = useState(true)
  const [isTogglingFaqs, setIsTogglingFaqs] = useState(false)

  useEffect(() => {
    if (workspace) setFaqsEnabled((workspace as any).faqsEnabled ?? true)
  }, [workspace])

  const handleToggleFaqsEnabled = async (enabled: boolean) => {
    if (!workspace?.id) return
    // Optimistic: the switch responds instantly, and rolls back if the save fails.
    setFaqsEnabled(enabled)
    setIsTogglingFaqs(true)
    try {
      await updateWorkspace(workspace.id, { faqsEnabled: enabled } as any)
      toast.success(enabled ? "FAQ answers enabled" : "FAQ answers disabled")
    } catch (error) {
      setFaqsEnabled(!enabled)
      logger.error("Failed to toggle FAQ answers:", error)
      toast.error("Could not save the change")
    } finally {
      setIsTogglingFaqs(false)
    }
  }

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

  // FAQs inside the currently open folder.
  const filteredFAQs =
    openCategory === null
      ? faqs
      : openCategory === UNCATEGORIZED_ID
        ? faqs.filter((faq) => !faq.category?.trim())
        : faqs.filter((faq) => faq.category?.trim() === openCategory)

  // Category folders derived from the FAQs themselves (categories are free
  // text on the FAQ row, not a table): one row per distinct name plus the
  // synthetic "Uncategorized" row, mirroring the Flow categories page.
  const categoryRows: FaqCategoryRow[] = [
    ...Array.from(
      faqs.reduce((map, faq) => {
        const name = faq.category?.trim()
        if (name) map.set(name, (map.get(name) ?? 0) + 1)
        return map
      }, new Map<string, number>())
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ id: name, name, count, isSynthetic: false })),
    {
      id: UNCATEGORIZED_ID,
      name: "Uncategorized",
      count: faqs.filter((faq) => !faq.category?.trim()).length,
      isSynthetic: true,
    },
  ]

  // Distinct categories already in use, offered as suggestions in the form
  // so the same category is spelled consistently across FAQs.
  const existingCategories = Array.from(
    new Set(
      faqs
        .map((faq) => faq.category?.trim())
        .filter((category): category is string => !!category)
    )
  ).sort()

  // Pagination
  const totalPages = Math.ceil(filteredFAQs.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedFAQs = filteredFAQs.slice(startIndex, endIndex)

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!workspace?.id) return

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const data = {
      question: formData.get("question") as string,
      answer: formData.get("answer") as string,
      category: (formData.get("category") as string)?.trim() || null,
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
      category: (formData.get("category") as string)?.trim() || null,
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

  // Folder navigation resets pagination so each view starts clean.
  const handleOpenCategory = (row: FaqCategoryRow) => {
    setOpenCategory(row.id)
    setCurrentPage(1)
  }

  const handleBackToCategories = () => {
    setOpenCategory(null)
    setCurrentPage(1)
  }

  // Renaming a category = updating every FAQ that carries it (categories are
  // free text on the FAQ rows, so there is no category record to update).
  // The prompt extraction groups FAQs by this same string, so the chatbot's
  // [Category] block follows the rename automatically.
  const handleRenameCategory = async (row: FaqCategoryRow, newName: string) => {
    if (!workspace?.id || newName === row.name) return
    const targets = faqs.filter((faq) => faq.category?.trim() === row.id)
    try {
      const updated = await Promise.all(
        targets.map((faq) =>
          faqApi.updateFAQ(workspace.id, faq.id, { category: newName })
        )
      )
      const byId = new Map(updated.map((faq) => [faq.id, faq]))
      setFaqs(faqs.map((faq) => byId.get(faq.id) ?? faq))
      toast.success("Category renamed")
    } catch (error) {
      logger.error("Error renaming category:", error)
      toast.error("Failed to rename category")
      // Resync: some FAQs may have been renamed before the failure.
      loadFAQs()
    }
  }

  // Deleting a category deletes every FAQ inside it — same semantics as
  // deleting a Flow category; the confirm dialog states it explicitly.
  const handleDeleteCategory = async (row: FaqCategoryRow) => {
    if (!workspace?.id) return
    const targets = faqs.filter((faq) => faq.category?.trim() === row.id)
    try {
      await Promise.all(
        targets.map((faq) => faqApi.deleteFAQ(workspace.id, faq.id))
      )
      const deleted = new Set(targets.map((faq) => faq.id))
      setFaqs(faqs.filter((faq) => !deleted.has(faq.id)))
      toast.success("Category deleted")
    } catch (error) {
      logger.error("Error deleting category:", error)
      toast.error("Failed to delete category")
      loadFAQs()
    }
  }

  if (!workspace?.id) {
    return <PageLayout><div>No workspace selected</div></PageLayout>
  }

  if (isLoading) {
    return <PageLayout><div className="text-center py-12">Loading FAQs...</div></PageLayout>
  }

  // Adding from inside a folder prefills that folder's category.
  const addDefaultCategory =
    openCategory && openCategory !== UNCATEGORIZED_ID ? openCategory : ""

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header — same "Settings" title + section dropdown as SettingsPage,
            so navigating here still reads as being inside Settings. */}
        <SettingsPageHeader currentSection="faqs" />

        {/* Master switch — same card pattern as the Settings sections. Turning it
            off keeps every FAQ intact but stops the block being added to the
            chatbot's prompt, which is the quick way to silence them all.
            Everything the section owns (Add button, count) lives inside the card
            and disappears with it, so a disabled section offers no actions. */}
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-500" />
                FAQ Answers
                <span className="text-sm font-normal text-gray-500">
                  {openCategory === null
                    ? `(${categoryRows.length} categories)`
                    : `(${filteredFAQs.length} items)`}
                </span>
              </CardTitle>
              <Switch
                checked={faqsEnabled}
                onCheckedChange={handleToggleFaqsEnabled}
                disabled={isTogglingFaqs}
              />
            </div>
            <p className="text-sm text-gray-500">
              {faqsEnabled
                ? "The chatbot uses these answers when a customer asks a matching question."
                : "Disabled — the chatbot ignores every FAQ below, but none of them are deleted."}
            </p>
          </CardHeader>
          {faqsEnabled && (
            <CardContent className="pt-6">
              {/* Same card layout as the Flow categories page: the primary
                  action alone, right-aligned. */}
              <div className="flex items-center justify-end">
                <Button onClick={() => setShowAddSheet(true)} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add FAQ
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Content is hidden while the section is off: browsing answers the
            chatbot is not using only invites confusion. Nothing is deleted —
            switching back on brings everything straight back. */}
        {!faqsEnabled ? null : openCategory === null ? (
          /* Top level: category folders, same representation as Flow. A new
             category is created by typing a new name in the Add FAQ form. */
          <FaqCategoryFolders
            rows={categoryRows}
            isLoading={isLoading}
            onOpen={handleOpenCategory}
            onRename={handleRenameCategory}
            onDelete={handleDeleteCategory}
          />
        ) : (
        <>
        {/* Inside a folder: back affordance + the FAQs of this category. */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToCategories}
            className="text-green-700 hover:text-green-800 hover:bg-green-50"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            All categories
          </Button>
          <h2 className="text-lg font-semibold text-gray-900">
            {openCategory === UNCATEGORIZED_ID ? "Uncategorized" : openCategory}
          </h2>
          <span className="text-sm text-gray-500">
            ({filteredFAQs.length} FAQs)
          </span>
        </div>

        {/* Cards Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading FAQs...</div>
        ) : filteredFAQs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No FAQs found. Create one to get started!
          </div>
        ) : (
          <FaqCardList
            faqs={paginatedFAQs}
            onEdit={handleEdit}
            onDelete={handleDelete}
            pagination={{
              currentPage,
              totalPages,
              startIndex,
              endIndex,
              totalCount: filteredFAQs.length,
              onPageChange: setCurrentPage,
            }}
          />
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
        <FaqFormFields
          faq={null}
          existingCategories={existingCategories}
          defaultCategory={addDefaultCategory}
        />
      </FormSheet>

      <FormSheet
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        title="Edit FAQ"
        description="Edit this frequently asked question"
        onSubmit={handleEditSubmit}
      >
        {selectedFAQ && (
          <FaqFormFields
            faq={selectedFAQ}
            existingCategories={existingCategories}
            defaultCategory=""
          />
        )}
      </FormSheet>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete FAQ"
        description={`Are you sure you want to delete the FAQ "${selectedFAQ?.question}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />

      {/* Chat Widget preview — same as SettingsPage, so the widget is visible
          while editing FAQs (they feed directly into the chatbot's prompt). */}
      {workspace.channelStatus !== false && (
        <ChatWidget
          workspaceId={workspace.id}
          title={workspace.widgetTitle}
          primaryColor={workspace.widgetPrimaryColor}
          icon={workspace.widgetIcon}
          logoUrl={resolveLogoUrl(workspace.logoUrl)}
          useChannelLogo={workspace.widgetUseChannelLogo}
          useWindowConfig={false}
          language={workspace.widgetLanguage}
        />
      )}
    </PageLayout>
  )
}
