import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Edit2, Trash2 } from "lucide-react"
import { FAQ } from "@/services/faqApi"

interface FaqCardListProps {
  /** The current page of FAQs (the parent owns filtering and slicing). */
  faqs: FAQ[]
  onEdit: (faq: FAQ) => void
  onDelete: (faq: FAQ) => void
  pagination: {
    currentPage: number
    totalPages: number
    startIndex: number
    endIndex: number
    totalCount: number
    onPageChange: (page: number) => void
  }
}

// The FAQ cards shown inside a category folder on FAQPage. No category pill:
// the list only renders inside a folder, where the category is already known.
export function FaqCardList({
  faqs,
  onEdit,
  onDelete,
  pagination,
}: FaqCardListProps) {
  const { currentPage, totalPages, startIndex, endIndex, totalCount, onPageChange } =
    pagination

  return (
    <>
    <div className="grid grid-cols-1 gap-4">
      {faqs.map((faq) => (
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
                  onClick={() => onEdit(faq)}
                  className="hover:bg-green-50 text-green-600 hover:text-green-700"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(faq)}
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
          Showing {startIndex + 1} to {Math.min(endIndex, totalCount)} of {totalCount} FAQs
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
                onClick={() => onPageChange(page)}
                className={currentPage === page ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    )}
    </>
  )
}
