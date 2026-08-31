import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristRestaurant } from "@/services/touristRestaurantApi"
import { PhotoGallery } from "./PhotoGallery"

interface TouristRestaurantFormFieldsProps {
  /** null = Add form, otherwise the restaurant being edited. */
  item: TouristRestaurant | null
  workspaceId: string
}

// Presentational form body shared by the Add and Edit sheets on
// TouristRestaurantsPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristRestaurantFormFields({
  item,
  workspaceId,
}: TouristRestaurantFormFieldsProps) {
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
        <Label htmlFor="cuisineType">Cuisine type</Label>
        <Input
          id="cuisineType"
          name="cuisineType"
          placeholder="e.g. tipica, pizzeria, pesce"
          defaultValue={item?.cuisineType ?? ""}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="celiacFriendly"
          name="celiacFriendly"
          defaultChecked={item?.celiacFriendly ?? false}
        />
        <Label htmlFor="celiacFriendly">Celiac friendly</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="needsReservation"
          name="needsReservation"
          defaultChecked={item?.needsReservation ?? false}
        />
        <Label htmlFor="needsReservation">Needs reservation</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={item?.location ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={item?.phone ?? ""} />
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
        contentType="RESTAURANT"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
