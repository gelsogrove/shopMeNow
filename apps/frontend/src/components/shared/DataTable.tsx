import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { commonStyles } from "@/styles/common"
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"
import React, { ReactNode, useState } from "react"

interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  globalFilter?: string
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement
  onEdit?: (item: TData) => void
  onDelete?: (item: TData) => void
  canDelete?: (item: TData) => boolean
  renderActions?: (item: TData) => React.ReactElement
  actionButtons?: (record: TData) => ReactNode
  searchKey?: string
  searchPlaceholder?: string
  onSearchChange?: (value: string) => void
  isLoading?: boolean
  getRowClassName?: (item: TData) => string
  disablePagination?: boolean // New prop to disable pagination
}

export function DataTable<TData>({
  data,
  columns,
  globalFilter,
  renderSubComponent,
  onEdit,
  onDelete,
  canDelete,
  renderActions,
  actionButtons,
  searchKey,
  searchPlaceholder,
  onSearchChange,
  isLoading = false,
  getRowClassName,
  disablePagination = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15, // Default to 15 items per page as requested by Andrea
  })

  const allColumns = React.useMemo(() => {
    const cols = [...columns]
    if (onEdit || onDelete || actionButtons || renderActions) {
      cols.push({
        id: "actions",
        header: () => (
          <span
            style={{ display: "block", width: "100%", minHeight: "1em" }}
          ></span>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end items-center space-x-2">
            {renderActions && renderActions(row.original)}
            {onEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleEdit(row)
                      }}
                      className="h-8 w-8 p-0 flex items-center justify-center"
                    >
                      <Pencil
                        className={`${commonStyles.actionIcon} ${commonStyles.primary}`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {onDelete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleDelete(row)
                      }}
                      disabled={canDelete ? !canDelete(row.original) : false}
                      className="h-8 w-8 p-0 flex items-center justify-center hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2
                        className={commonStyles.actionIcon + " text-red-600"}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{canDelete && !canDelete(row.original) ? "Cannot delete (in use)" : "Delete"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ),
      })
    }
    return cols
  }, [columns, onEdit, onDelete, canDelete, actionButtons, renderActions])

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: disablePagination
        ? { pageIndex: 0, pageSize: data.length }
        : pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: disablePagination
      ? undefined
      : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: disablePagination ? 1000 : 15,
      },
    },
  })

  const handleEdit = (row: Row<TData>) => {
    if (onEdit) {
      onEdit(row.original)
    }
  }

  const handleDelete = (row: Row<TData>) => {
    if (onDelete) {
      onDelete(row.original)
    }
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {(searchKey || onSearchChange) && (
        <div className="flex items-center border rounded-md px-3 mb-4">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <Input
            placeholder={searchPlaceholder || "Search..."}
            value={globalFilter}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="py-1"
                        style={{
                          width: header.column.columnDef.size
                            ? `${header.column.columnDef.size}px`
                            : "auto",
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => {
                    const baseClassName = "h-[40px]"
                    const customClassName = getRowClassName
                      ? getRowClassName(row.original)
                      : ""
                    const rowClassName = customClassName
                      ? `${baseClassName} ${customClassName}`
                      : baseClassName

                    return (
                      <React.Fragment key={row.id}>
                        <TableRow className={rowClassName}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className="py-1"
                              style={{
                                width: cell.column.columnDef.size
                                  ? `${cell.column.columnDef.size}px`
                                  : "auto",
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                        {row.getIsExpanded() && renderSubComponent && (
                          <TableRow>
                            <TableCell colSpan={allColumns.length}>
                              {renderSubComponent({ row })}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={allColumns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Enhanced Pagination Controls - Hidden if disablePagination is true */}
          {!disablePagination && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-500">
                  Showing{" "}
                  {table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    1}{" "}
                  to{" "}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) *
                      table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length
                  )}{" "}
                  of {table.getFilteredRowModel().rows.length} entries
                </p>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                      table.setPageSize(Number(value))
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue
                        placeholder={table.getState().pagination.pageSize}
                      />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 15, 20, 30, 50].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">
                    Page {table.getState().pagination.pageIndex + 1} of{" "}
                    {table.getPageCount()}
                  </p>
                </div>

                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
