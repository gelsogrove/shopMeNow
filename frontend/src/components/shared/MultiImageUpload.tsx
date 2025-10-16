import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { IMG_BASE_URL } from "@/config"
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd"
import { ImagePlus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface MultiImageUploadProps {
  onImagesSelected: (files: File[]) => void
  onImagesReordered?: (newImageUrls: string[]) => void
  currentImageUrls?: string[]
  label?: string
  required?: boolean
  maxImages?: number
}

/**
 * Component for multiple image uploads with drag and drop reordering
 * Validates file size (max 4MB per file) and format (PNG, JPG, JPEG, GIF, WEBP, SVG, BMP)
 */
export function MultiImageUpload({
  onImagesSelected,
  onImagesReordered,
  currentImageUrls = [],
  label = "Images",
  required = false,
  maxImages = 10,
}: MultiImageUploadProps) {
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [error, setError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Max file size: 4MB
  const MAX_FILE_SIZE = 4 * 1024 * 1024

  // Allowed MIME types
  const ALLOWED_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
  ]

  // Load existing images on component mount
  useEffect(() => {
    if (currentImageUrls && currentImageUrls.length > 0) {
      const formattedUrls = currentImageUrls.map((url) => {
        if (url.startsWith("http")) {
          return url
        } else {
          return `${IMG_BASE_URL}${url}`
        }
      })
      setPreviewImages(formattedUrls)
    }
  }, [currentImageUrls])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    if (!selectedFiles.length) return

    // Check if adding these files would exceed the maximum
    if (
      imageFiles.length + selectedFiles.length + previewImages.length >
      maxImages
    ) {
      setError(`You can only upload a maximum of ${maxImages} images`)
      return
    }

    // Validate file sizes and types
    const invalidFiles = selectedFiles.filter(
      (file) => file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.includes(file.type)
    )

    if (invalidFiles.length > 0) {
      setError(
        "Some files were rejected. Make sure each file is less than 4MB and in PNG, JPG, JPEG, GIF, WEBP, SVG, or BMP format"
      )
      return
    }

    setError("")

    // Create preview URLs for the new files
    const newPreviewUrls = selectedFiles.map((file) =>
      URL.createObjectURL(file)
    )

    // Update state with new files
    setImageFiles((prev) => [...prev, ...selectedFiles])

    // Update preview images (excluding existing URLs that came from currentImageUrls)
    setPreviewImages((prev) => {
      const existingUrls =
        currentImageUrls?.map((url) =>
          url.startsWith("http") ? url : `${IMG_BASE_URL}${url}`
        ) || []

      // Only add previews for new files that aren't from existing URLs
      const existingPreviews = prev.filter((p) => existingUrls.includes(p))
      return [...existingPreviews, ...newPreviewUrls]
    })

    // Notify parent component
    onImagesSelected(selectedFiles)

    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveImage = (index: number) => {
    // Determine if the image is a file or an existing URL
    const isExistingImage =
      index < previewImages.length &&
      (currentImageUrls?.includes(previewImages[index]) ||
        currentImageUrls
          ?.map((url) => `${IMG_BASE_URL}${url}`)
          .includes(previewImages[index]))

    if (isExistingImage) {
      // If it's an existing image, filter it out from previewImages
      const newPreviewImages = [...previewImages]
      const removedUrl = newPreviewImages.splice(index, 1)[0]
      setPreviewImages(newPreviewImages)

      // If onImagesReordered is provided, notify parent about the change
      if (onImagesReordered) {
        // Convert URLs back to the format expected by backend
        const updatedUrls = newPreviewImages
          .filter((url) => {
            // Only include urls that were in the original currentImageUrls
            const originalUrl = url.replace(IMG_BASE_URL, "")
            return (
              currentImageUrls?.includes(url) ||
              currentImageUrls?.includes(originalUrl)
            )
          })
          .map((url) => {
            // Convert back to the format expected by backend
            if (url.startsWith(IMG_BASE_URL)) {
              return url.replace(IMG_BASE_URL, "")
            }
            return url
          })
        onImagesReordered(updatedUrls)
      }
    } else {
      // If it's a new file upload, adjust the index to remove from imageFiles
      const fileIndex = index - (previewImages.length - imageFiles.length)
      if (fileIndex >= 0) {
        const newImageFiles = [...imageFiles]
        newImageFiles.splice(fileIndex, 1)
        setImageFiles(newImageFiles)

        // Also remove the preview
        const newPreviewImages = [...previewImages]
        const removedUrl = newPreviewImages.splice(index, 1)[0]
        setPreviewImages(newPreviewImages)

        // Release the object URL to avoid memory leaks
        URL.revokeObjectURL(removedUrl)

        // Notify parent component about updated files
        onImagesSelected(newImageFiles)
      }
    }
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const { source, destination } = result
    const sourceIndex = source.index
    const destIndex = destination.index

    // Reorder preview images
    const newPreviewImages = Array.from(previewImages)
    const [removed] = newPreviewImages.splice(sourceIndex, 1)
    newPreviewImages.splice(destIndex, 0, removed)
    setPreviewImages(newPreviewImages)

    // If onImagesReordered is provided, notify parent about the change
    if (onImagesReordered) {
      // Filter and convert URLs to the format expected by the backend
      const existingImageUrls = newPreviewImages
        .filter((url) => {
          // Only include urls that were in the original currentImageUrls
          const originalUrl = url.replace(IMG_BASE_URL, "")
          return (
            currentImageUrls?.includes(url) ||
            currentImageUrls?.includes(originalUrl)
          )
        })
        .map((url) => {
          // Convert back to the format expected by backend
          if (url.startsWith(IMG_BASE_URL)) {
            return url.replace(IMG_BASE_URL, "")
          }
          return url
        })

      onImagesReordered(existingImageUrls)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="grid w-full items-center gap-1.5">
      <Label htmlFor="multi-image">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>

      <div className="mt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleUploadClick}
          disabled={previewImages.length >= maxImages}
          className="mb-4 w-full"
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Add Images ({previewImages.length}/{maxImages})
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          multiple
          className="hidden"
        />

        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

        {previewImages.length > 0 && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="images" direction="horizontal">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4"
                >
                  {previewImages.map((url, index) => (
                    <Draggable key={url} draggableId={url} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="relative group"
                        >
                          <Card className="overflow-hidden">
                            <img
                              src={url}
                              alt={`Preview ${index + 1}`}
                              className="object-cover w-full h-32"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveImage(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <div className="p-2 text-center text-xs text-muted-foreground">
                              #{index + 1}
                            </div>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {previewImages.length === 0 && (
          <div className="border-2 border-dashed border-muted rounded-md p-8 text-center">
            <p className="text-muted-foreground">
              No images selected. Click "Add Images" to upload.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
