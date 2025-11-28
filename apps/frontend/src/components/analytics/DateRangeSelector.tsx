import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateRange } from "@/services/analyticsApi"
import { CalendarIcon } from "lucide-react"
import React from "react"
import { getAdminPageTexts } from "../../utils/adminPageTranslations"

export type PeriodPreset = "week" | "30days" | "3months" | "6months" | "1year"

interface DateRangeSelectorProps {
  selectedPeriod: PeriodPreset
  onPeriodChange: (period: PeriodPreset) => void
}

export const getDateRangeFromPeriod = (period: PeriodPreset): DateRange => {
  const endDate = new Date()
  const startDate = new Date()

  switch (period) {
    case "week":
      startDate.setDate(endDate.getDate() - 7)
      break
    case "30days":
      startDate.setDate(endDate.getDate() - 30)
      break
    case "3months":
      startDate.setMonth(endDate.getMonth() - 3)
      break
    case "6months":
      startDate.setMonth(endDate.getMonth() - 6)
      break
    case "1year":
      startDate.setFullYear(endDate.getFullYear() - 1)
      break
    default:
      startDate.setDate(endDate.getDate() - 7)
  }

  return {
    startDate,
    endDate,
  }
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  selectedPeriod,
  onPeriodChange,
}) => {
  const t = getAdminPageTexts()

  const periodOptions = [
    {
      value: "week" as PeriodPreset,
      label: t.lastWeek,
      description: t.lastWeekDesc,
    },
    {
      value: "30days" as PeriodPreset,
      label: t.last30Days,
      description: t.last30DaysDesc,
    },
    {
      value: "3months" as PeriodPreset,
      label: t.last3Months,
      description: t.last3MonthsDesc,
    },
    {
      value: "6months" as PeriodPreset,
      label: t.last6Months,
      description: t.last6MonthsDesc,
    },
    {
      value: "1year" as PeriodPreset,
      label: t.lastYear,
      description: t.lastYearDesc,
    },
  ]

  const currentOption = periodOptions.find(
    (option) => option.value === selectedPeriod
  )

  return (
    <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center space-x-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Period:</span>
      </div>
      <Select value={selectedPeriod} onValueChange={onPeriodChange}>
        <SelectTrigger className="w-48">
          <SelectValue>{currentOption?.label || "Select period"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {periodOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default DateRangeSelector
