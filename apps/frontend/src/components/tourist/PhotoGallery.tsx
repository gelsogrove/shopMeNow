import { logger } from "@/lib/logger"
import { toast } from "@/lib/toast"
import { Loader2, Upload, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  TouristContentType,
  TouristPhoto,
  touristPhotoApi,
} from "@/services/touristPhotoApi"

interface PhotoGalleryProps {
  workspaceId: string
  contentType: TouristContentType
  // null when the parent content item hasn't been created yet (Add form) —
  // gallery is disabled/hidden until the item is saved.
  contentId: string | null
}

// Backend just stores whatever string it's given — accept both raw base64
// and a full data URI and normalize for <img src>.
function toImageSrc(imageBase64: string): string {
  return imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function PhotoGallery({ workspaceId, contentType, contentId }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<TouristPhoto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!contentId) {
      setPhotos([])
      return
    }
    let cancelled = false
    setIsLoading(true)
    touristPhotoApi
      .getGallery(workspaceId, contentType, contentId)
      .then((data) => {
        if (!cancelled) setPhotos(data)
      })
      .catch((error) => {
        logger.error("Error loading photo gallery:", error)
        toast.error("Failed to load photos")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, contentType, contentId])

  const handleDelete = async (photo: TouristPhoto) => {
    // Optimistic removal — roll back if the delete call fails.
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    try {
      await touristPhotoApi.deletePhoto(workspaceId, photo.id)
    } catch (error) {
      logger.error("Error deleting photo:", error)
      toast.error("Failed to delete photo")
      setPhotos((prev) => [...prev, photo].sort((a, b) => a.order - b.order))
    }
  }

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !contentId) return
    const fileArray = Array.from(files)
    setUploadingCount(fileArray.length)
    for (const file of fileArray) {
      try {
        const dataUrl = await readFileAsDataUrl(file)
        const created = await touristPhotoApi.addPhoto(workspaceId, {
          contentType,
          contentId,
          imageBase64: dataUrl,
        })
        setPhotos((prev) => [...prev, created])
      } catch (error) {
        logger.error("Error uploading photo:", error)
        toast.error(`Failed to upload ${file.name}`)
      } finally {
        setUploadingCount((prev) => Math.max(0, prev - 1))
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (!contentId) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Photo gallery</p>
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          Save first to add photos
        </div>
      </div>
    )
  }

  // TODO: drag-to-reorder using touristPhotoApi.reorderGallery

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">
        Photo gallery{" "}
        <span className="text-xs font-normal text-gray-500">({photos.length})</span>
      </p>
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
              >
                <img
                  src={toImageSrc(photo.imageBase64)}
                  alt={photo.caption ?? ""}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(photo)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label="Delete photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

          {Array.from({ length: uploadingCount }).map((_, i) => (
            <div
              key={`uploading-${i}`}
              className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
            >
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-green-500 hover:text-green-600 hover:bg-green-50 transition-colors"
          >
            <Upload className="h-5 w-5" />
            <span className="text-xs">Upload</span>
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
    </div>
  )
}
