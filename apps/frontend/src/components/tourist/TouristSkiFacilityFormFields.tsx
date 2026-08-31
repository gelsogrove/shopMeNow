import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristSkiFacility } from "@/services/touristSkiFacilityApi"
import { PhotoGallery } from "./PhotoGallery"

interface TouristSkiFacilityFormFieldsProps {
  /** null = Add form, otherwise the ski facility being edited. */
  item: TouristSkiFacility | null
  workspaceId: string
}

// Free-text suggestions like the excursion difficulty field — the value stays
// free text in the DB, the LLM reads it as prose.
const SLOPE_TYPE_OPTIONS = ["blu", "rossa", "nera"]

// Presentational form body shared by the Add and Edit sheets on
// TouristSkiFacilitiesPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristSkiFacilityFormFields({
  item,
  workspaceId,
}: TouristSkiFacilityFormFieldsProps) {
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
          className="min-h-[120px]"
          defaultValue={item?.description ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slopeType">Slope type</Label>
        <Input
          id="slopeType"
          name="slopeType"
          list="ski-slope-type-options"
          placeholder="es. blu, rossa, nera"
          defaultValue={item?.slopeType ?? ""}
        />
        <datalist id="ski-slope-type-options">
          {SLOPE_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={item?.location ?? ""} />
      </div>
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
        contentType="SKI_FACILITY"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
