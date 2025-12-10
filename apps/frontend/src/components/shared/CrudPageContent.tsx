import { type ColumnDef } from "@tanstack/react-table"
import { ReactNode } from "react"
import { DataTable } from "./DataTable"
import { PageHeader } from "./PageHeader"
import { Card, CardContent } from "@/components/ui/card"

interface CrudPageContentProps<T> {
  title: string | ReactNode
  titleIcon?: ReactNode
  searchValue: string
  onSearch: (value: string) => void
  searchPlaceholder?: string
  onAdd?: () => void
  addButtonText?: string
  extraButtons?: ReactNode
  data: T[]
  columns: ColumnDef<T>[]
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  isLoading?: boolean
  renderActions?: (item: T) => React.ReactElement
  renderEmptyState?: ReactNode
  getRowClassName?: (item: T) => string
  disablePagination?: boolean // New prop to disable pagination
}

/**
 * A standardized component for CRUD pages with search, header and data table
 */
export function CrudPageContent<T>({
  title,
  titleIcon,
  searchValue,
  onSearch,
  searchPlaceholder,
  onAdd,
  addButtonText,
  extraButtons,
  data,
  columns,
  onEdit,
  onDelete,
  isLoading,
  renderActions,
  renderEmptyState,
  getRowClassName,
  disablePagination = false,
}: CrudPageContentProps<T>) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-96">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="min-h-[calc(100vh-13.7rem)]">
      <CardContent className="p-6">
        <PageHeader
          title={title}
          titleIcon={titleIcon}
          searchValue={searchValue}
          onSearch={onSearch}
          searchPlaceholder={searchPlaceholder}
          onAdd={onAdd}
          addButtonText={addButtonText}
          extraButtons={extraButtons}
          itemCount={data.length}
        />

        {data.length === 0 && renderEmptyState ? (
          renderEmptyState
        ) : (
          <div className="mt-6 w-full">
            <DataTable
              data={data}
              columns={columns}
              globalFilter=""
              onEdit={onEdit}
              onDelete={onDelete}
              renderActions={renderActions}
              getRowClassName={getRowClassName}
              disablePagination={disablePagination}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
