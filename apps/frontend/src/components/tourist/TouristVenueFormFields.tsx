import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristVenue } from "@/services/touristVenueApi"
import { LocationField } from "./LocationField"
import { PhotoGallery } from "./PhotoGallery"

interface TouristVenueFormFieldsProps {
  /** null = Add form, otherwise the item being edited. */
  item: TouristVenue | null
  workspaceId: string
}

// Free-text suggestions like the other tourist forms — the value stays free
// text in the DB, the LLM reads it as prose.
const VENUETYPE_OPTIONS = ["bar", "pub", "birreria", "caffè", "enoteca", "gelateria"]

// Presentational form body shared by the Add and Edit sheets on
// TouristVenuesPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristVenueFormFields({
  item,
  workspaceId,
}: TouristVenueFormFieldsProps) {
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
        <Label htmlFor="venueType">Venue type</Label>
        <Input
          id="venueType"
          name="venueType"
          list="touristVenue-venueType-options"
          placeholder="es. bar, pub, birreria"
          defaultValue={item?.venueType ?? ""}
        />
        <datalist id="touristVenue-venueType-options">
          {VENUETYPE_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label htmlFor="openingHours">Opening hours</Label>
        <Input
          id="openingHours"
          name="openingHours"
          placeholder="es. 8:00-22:00"
          defaultValue={item?.openingHours ?? ""}
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
        contentType="VENUE"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
