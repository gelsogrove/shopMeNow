import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristChurch } from "@/services/touristChurchApi"
import { LocationField } from "./LocationField"
import { PhotoGallery } from "./PhotoGallery"

interface TouristChurchFormFieldsProps {
  /** null = Add form, otherwise the item being edited. */
  item: TouristChurch | null
  workspaceId: string
}

// Free-text suggestions like the other tourist forms — the value stays free
// text in the DB, the LLM reads it as prose.
const STYLE_OPTIONS = ["gotico", "barocco", "romanico", "alpino", "contemporaneo"]

// Presentational form body shared by the Add and Edit sheets on
// TouristChurchesPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristChurchFormFields({
  item,
  workspaceId,
}: TouristChurchFormFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={item?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          className="min-h-[260px]"
          defaultValue={item?.description ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="century">Century / era</Label>
        <Input
          id="century"
          name="century"
          placeholder="es. XV secolo"
          defaultValue={item?.century ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="style">Style</Label>
        <Input
          id="style"
          name="style"
          list="touristChurch-style-options"
          placeholder="es. gotico, barocco"
          defaultValue={item?.style ?? ""}
        />
        <datalist id="touristChurch-style-options">
          {STYLE_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={item?.phone ?? ""}
        />
      </div>
      <LocationField defaultValue={item?.location} />
      <div className="space-y-2">
        <Label htmlFor="link">Link</Label>
        <Input id="link" name="link" defaultValue={item?.link ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="videoUrl">Video URL</Label>
        <Input id="videoUrl" name="videoUrl" defaultValue={item?.videoUrl ?? ""} />
      </div>

      <PhotoGallery
        workspaceId={workspaceId}
        contentType="CHURCH"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
