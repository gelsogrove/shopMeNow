import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TouristViewpoint } from "@/services/touristViewpointApi"
import { DescriptionField } from "./DescriptionField"
import { LocationField } from "./LocationField"
import { PhotoGallery } from "./PhotoGallery"

interface TouristViewpointFormFieldsProps {
  /** null = Add form, otherwise the item being edited. */
  item: TouristViewpoint | null
  workspaceId: string
}

// Free-text suggestions like the other tourist forms — the value stays free
// text in the DB, the LLM reads it as prose.
const ACCESS_OPTIONS = ["a piedi", "in auto", "seggiovia", "misto"]
const DIFFICULTY_OPTIONS = ["facile", "media", "difficile"]

// Presentational form body shared by the Add and Edit sheets on
// TouristViewpointsPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristViewpointFormFields({
  item,
  workspaceId,
}: TouristViewpointFormFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={item?.name} required />
      </div>
      <DescriptionField defaultValue={item?.description} />
      <div className="space-y-2">
        <Label htmlFor="altitude">Altitude (m)</Label>
        <Input
          id="altitude"
          name="altitude"
          type="number"
          min={0}
          placeholder="es. 1830"
          defaultValue={item?.altitude ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="access">Access</Label>
        <Input
          id="access"
          name="access"
          list="touristViewpoint-access-options"
          placeholder="es. a piedi, in auto"
          defaultValue={item?.access ?? ""}
        />
        <datalist id="touristViewpoint-access-options">
          {ACCESS_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label htmlFor="difficulty">Difficulty</Label>
        <Input
          id="difficulty"
          name="difficulty"
          list="touristViewpoint-difficulty-options"
          placeholder="es. facile, media"
          defaultValue={item?.difficulty ?? ""}
        />
        <datalist id="touristViewpoint-difficulty-options">
          {DIFFICULTY_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
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
        contentType="VIEWPOINT"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
