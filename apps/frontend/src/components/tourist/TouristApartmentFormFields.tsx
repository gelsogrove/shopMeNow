import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TouristApartment } from "@/services/touristApartmentApi"
import { PhotoGallery } from "./PhotoGallery"

interface TouristApartmentFormFieldsProps {
  /** null = Add form, otherwise the apartment being edited. */
  item: TouristApartment | null
  workspaceId: string
}

// Presentational form body shared by the Add and Edit sheets on
// TouristApartmentsPage. Uncontrolled inputs: the parent reads values via
// FormData on submit.
export function TouristApartmentFormFields({ item, workspaceId }: TouristApartmentFormFieldsProps) {
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
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          name="category"
          placeholder="e.g. Appartamento, Affittacamere, Residence, Agenzia, Consorzio"
          defaultValue={item?.category ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={item?.location ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="streetNumber">Street number</Label>
          <Input id="streetNumber" name="streetNumber" defaultValue={item?.streetNumber ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={item?.phone ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input id="mobile" name="mobile" defaultValue={item?.mobile ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={item?.email ?? ""} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rooms">Rooms</Label>
          <Input
            id="rooms"
            name="rooms"
            type="number"
            min="0"
            defaultValue={item?.rooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="beds">Beds</Label>
          <Input
            id="beds"
            name="beds"
            type="number"
            min="0"
            defaultValue={item?.beds ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bathrooms">Bathrooms</Label>
          <Input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min="0"
            defaultValue={item?.bathrooms ?? ""}
          />
        </div>
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
        contentType="APARTMENT"
        contentId={item?.id ?? null}
      />

      <div className="flex items-center space-x-2">
        <Switch id="isActive" name="isActive" defaultChecked={item ? item.isActive : true} />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </div>
  )
}
