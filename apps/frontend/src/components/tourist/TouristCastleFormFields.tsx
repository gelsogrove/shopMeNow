import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TouristCastle } from "@/services/touristCastleApi"
import { DescriptionField } from "./DescriptionField"
import { LocationField } from "./LocationField"
import { PhotoGallery } from "./PhotoGallery"

interface TouristCastleFormFieldsProps {
  /** null = Add form, otherwise the item being edited. */
  item: TouristCastle | null
  workspaceId: string
}

// Presentational form body shared by the Add and Edit sheets on
// TouristCastlesPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristCastleFormFields({
  item,
  workspaceId,
}: TouristCastleFormFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={item?.name} required />
      </div>
      <DescriptionField defaultValue={item?.description} />
      <div className="space-y-2">
        <Label htmlFor="century">Century / era</Label>
        <Input
          id="century"
          name="century"
          placeholder="es. XII secolo"
          defaultValue={item?.century ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="visitInfo">Visit info</Label>
        <Input
          id="visitInfo"
          name="visitInfo"
          placeholder="es. visitabile, aperto giu-set"
          defaultValue={item?.visitInfo ?? ""}
        />
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
        contentType="CASTLE"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
