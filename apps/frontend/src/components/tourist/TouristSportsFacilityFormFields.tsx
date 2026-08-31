import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristSportsFacility } from "@/services/touristSportsFacilityApi"
import { PhotoGallery } from "./PhotoGallery"

interface TouristSportsFacilityFormFieldsProps {
  /** null = Add form, otherwise the sports facility being edited. */
  item: TouristSportsFacility | null
  workspaceId: string
}

// Free-text suggestions (Andrea, 2026-09-01): the chatbot reads the value as
// an explicit "Stagione" fact and checks it against the runtime season.
const SEASON_OPTIONS = ["estiva", "invernale", "tutto l'anno"]

// Presentational form body shared by the Add and Edit sheets on
// TouristSportsFacilitiesPage. Uncontrolled inputs: the parent reads values
// via FormData on submit.
export function TouristSportsFacilityFormFields({
  item,
  workspaceId,
}: TouristSportsFacilityFormFieldsProps) {
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
        <Label htmlFor="sport">Sport</Label>
        <Input
          id="sport"
          name="sport"
          placeholder="es. golf, tennis"
          defaultValue={item?.sport ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="season">Season</Label>
        <Input
          id="season"
          name="season"
          list="sports-facility-season-options"
          placeholder="es. estiva, invernale, tutto l'anno"
          defaultValue={item?.season ?? ""}
        />
        <datalist id="sports-facility-season-options">
          {SEASON_OPTIONS.map((option) => (
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
        contentType="SPORTS_FACILITY"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
