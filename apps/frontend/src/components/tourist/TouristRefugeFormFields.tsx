import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristRefuge } from "@/services/touristRefugeApi"
import { LocationField } from "./LocationField"
import { PhotoGallery } from "./PhotoGallery"

interface TouristRefugeFormFieldsProps {
  /** null = Add form, otherwise the refuge being edited. */
  item: TouristRefuge | null
  workspaceId: string
}

// Presentational form body shared by the Add and Edit sheets on
// TouristRefugesPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristRefugeFormFields({ item, workspaceId }: TouristRefugeFormFieldsProps) {
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
        <Label htmlFor="climbTime">Tempo di salita</Label>
        <Input
          id="climbTime"
          name="climbTime"
          placeholder="es. 1h45"
          defaultValue={item?.climbTime ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="difficulty">Difficoltà</Label>
        <Input id="difficulty" name="difficulty" defaultValue={item?.difficulty ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="openFrom">Aperto da</Label>
        <Input id="openFrom" name="openFrom" defaultValue={item?.openFrom ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="openTo">Aperto a</Label>
        <Input id="openTo" name="openTo" defaultValue={item?.openTo ?? ""} />
      </div>
      <LocationField defaultValue={item?.location} />
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={item?.phone ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={item?.email ?? ""} />
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
        contentType="REFUGE"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
