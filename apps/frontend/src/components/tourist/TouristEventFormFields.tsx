import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristEvent } from "@/services/touristEventApi"
import { PhotoGallery } from "./PhotoGallery"

interface TouristEventFormFieldsProps {
  /** null = Add form, otherwise the event being edited. */
  item: TouristEvent | null
  workspaceId: string
}

// <input type="date"> wants a plain YYYY-MM-DD value.
function toDateInputValue(value?: string | null): string {
  return value ? value.slice(0, 10) : ""
}

// Presentational form body shared by the Add and Edit sheets on
// TouristEventsPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristEventFormFields({ item, workspaceId }: TouristEventFormFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={item?.title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          className="min-h-[120px]"
          defaultValue={item?.description ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={item?.location ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startDate">Start date</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={toDateInputValue(item?.startDate)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endDate">End date</Label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={toDateInputValue(item?.endDate)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Price</Label>
        <Input
          id="price"
          name="price"
          placeholder="es. Gratuito, 10€"
          defaultValue={item?.price ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticketInfo">Ticket info</Label>
        <Textarea
          id="ticketInfo"
          name="ticketInfo"
          className="min-h-[80px]"
          defaultValue={item?.ticketInfo ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="link">Link</Label>
        <Input id="link" name="link" defaultValue={item?.link ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ticketLink">Ticket link</Label>
        <Input id="ticketLink" name="ticketLink" defaultValue={item?.ticketLink ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="videoUrl">Video URL</Label>
        <Input id="videoUrl" name="videoUrl" defaultValue={item?.videoUrl ?? ""} />
      </div>

      <PhotoGallery
        workspaceId={workspaceId}
        contentType="EVENT"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
