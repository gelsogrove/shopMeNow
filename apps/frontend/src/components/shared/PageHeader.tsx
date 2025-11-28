import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { commonStyles } from "@/styles/common"
import { Plus } from "lucide-react"
import { ReactNode } from "react"

interface PageHeaderProps {
  title: ReactNode
  titleIcon?: ReactNode
  description?: string
  searchValue?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  onAdd?: () => void
  itemCount?: number
  addButtonText?: string
  addButtonIcon?: ReactNode
  extraButtons?: ReactNode
}

export function PageHeader({
  title,
  titleIcon,
  description,
  searchValue,
  onSearch,
  searchPlaceholder,
  onAdd,
  itemCount,
  addButtonText = "Add",
  addButtonIcon,
  extraButtons,
}: PageHeaderProps) {
  const titleContent = typeof title === 'string' ? <span className={commonStyles.primary}>{title}</span> : title;
  const wrappedTitleIcon = titleIcon ? <div className={commonStyles.primary}>{titleIcon}</div> : null;
  
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {wrappedTitleIcon}
          <h1 className="text-2xl font-bold">{titleContent}</h1>
        </div>
        <div className="flex items-center gap-3">
          {onSearch && (
            <Input
              type="search"
              placeholder={searchPlaceholder || "Search..."}
              value={searchValue}
              onChange={(e) => onSearch(e.target.value)}
              className="max-w-[180px]"
            />
          )}
          {extraButtons}
          {onAdd && (
            <Button
              onClick={onAdd}
              size="sm"
              className={commonStyles.buttonPrimary}
            >
              {addButtonIcon || <Plus className="h-4 w-4 mr-1.5 text-white" />}
              {addButtonText}
            </Button>
          )}
        </div>
      </div>
      
      {/* Description text */}
      {description && (
        <div className="text-sm text-muted-foreground ml-1">
          {description}
        </div>
      )}
      
      {/* Standardized item count display */}
      {itemCount !== undefined && (
        <div className="text-sm text-muted-foreground ml-1">
          {itemCount} items
        </div>
      )}
    </div>
  )
}
