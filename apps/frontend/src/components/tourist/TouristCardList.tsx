import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Edit2, Trash2 } from "lucide-react"
import { ReactNode } from "react"

interface PaginationState {
  currentPage: number
  totalPages: number
  startIndex: number
  endIndex: number
  totalCount: number
  onPageChange: (page: number) => void
}

interface TouristCardListProps<T extends { id: string; isActive: boolean }> {
  items: T[]
  onEdit: (item: T) => void
  onDelete: (item: T) => void
  pagination: PaginationState
  // Type-specific body of each card (title, facts, etc). The isActive badge
  // and edit/delete actions are handled generically by this component.
  renderContent: (item: T) => ReactNode
}

// Generic paginated card list shared by the PRO_LOCO tourist content pages
// (restaurants, hotels, excursions, refuges, events). Mirrors the pagination
// chrome from FaqCardList.tsx; the per-item content is supplied by the caller.
export function TouristCardList<T extends { id: string; isActive: boolean }>({
  items,
  onEdit,
  onDelete,
  pagination,
  renderContent,
}: TouristCardListProps<T>) {
  const { currentPage, totalPages, startIndex, endIndex, totalCount, onPageChange } =
    pagination

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <Card key={item.id} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">{renderContent(item)}</div>
              <div className="flex gap-4 flex-shrink-0 items-center">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    item.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                    className="hover:bg-green-50 text-green-600 hover:text-green-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item)}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, totalCount)} of {totalCount}
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
