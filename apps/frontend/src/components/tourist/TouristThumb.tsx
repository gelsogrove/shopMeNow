import { logger } from "@/lib/logger"
import {
  TouristContentType,
  touristPhotoApi,
} from "@/services/touristPhotoApi"
import { Building2, CableCar, CalendarDays, Dumbbell, Home, KeyRound, Mountain, Utensils } from "lucide-react"
import { useEffect, useState } from "react"

interface TouristThumbProps {
  workspaceId: string
  contentType: TouristContentType
  contentId: string
}

// Icon + colors per category, consistent with the hub cards in
// TouristContentPage.tsx. Used for the default placeholder when an item has
// no gallery photo (Andrea, 2026-08-31: "SE NON C'È METTI IMMAGINE DI
// DEFAULT" — a FE placeholder, not a DB image).
const CATEGORY_STYLE: Record<
  TouristContentType,
  {
    icon: React.ComponentType<{ className?: string }>
    iconBg: string
    iconColor: string
  }
> = {
  RESTAURANT: { icon: Utensils, iconBg: "bg-orange-100", iconColor: "text-orange-600" },
  HOTEL: { icon: Building2, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  EXCURSION: { icon: Mountain, iconBg: "bg-green-100", iconColor: "text-green-600" },
  REFUGE: { icon: Home, iconBg: "bg-amber-100", iconColor: "text-amber-700" },
  EVENT: { icon: CalendarDays, iconBg: "bg-purple-100", iconColor: "text-purple-600" },
  APARTMENT: { icon: KeyRound, iconBg: "bg-teal-100", iconColor: "text-teal-600" },
  SPORTS_FACILITY: { icon: Dumbbell, iconBg: "bg-rose-100", iconColor: "text-rose-600" },
  SKI_FACILITY: { icon: CableCar, iconBg: "bg-sky-100", iconColor: "text-sky-600" },
}

// Module-level cache so re-renders and pagination don't refetch the gallery
// for items already resolved. null = resolved with no photo (placeholder).
const thumbCache = new Map<string, string | null>()

// 64x64 thumbnail for a tourist content card: the item's first gallery photo
// if it has one, otherwise the category-icon placeholder.
export function TouristThumb({ workspaceId, contentType, contentId }: TouristThumbProps) {
  const cacheKey = `${contentType}:${contentId}`
  const [image, setImage] = useState<string | null>(
    () => thumbCache.get(cacheKey) ?? null
  )

  useEffect(() => {
    let cancelled = false
    if (thumbCache.has(cacheKey)) {
      setImage(thumbCache.get(cacheKey) ?? null)
      return
    }
    const load = async () => {
      try {
        const photos = await touristPhotoApi.getGallery(
          workspaceId,
          contentType,
          contentId
        )
        const first = photos.length > 0 ? photos[0].imageBase64 : null
        thumbCache.set(cacheKey, first)
        if (!cancelled) setImage(first)
      } catch (error) {
        // Transient errors are NOT cached, so a later mount can retry.
        logger.error("Error loading tourist thumbnail:", error)
        if (!cancelled) setImage(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, contentType, contentId, cacheKey])

  if (image) {
    return (
      <img
        src={image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`}
        alt=""
        className="w-16 h-16 rounded-lg object-cover"
      />
    )
  }

  const { icon: Icon, iconBg, iconColor } = CATEGORY_STYLE[contentType]
  return (
    <div className={`w-16 h-16 rounded-lg ${iconBg} flex items-center justify-center`}>
      <Icon className={`w-6 h-6 ${iconColor}`} />
    </div>
  )
}
