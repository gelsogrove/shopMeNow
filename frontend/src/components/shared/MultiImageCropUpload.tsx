import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { IMG_BASE_URL } from "@/config"
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd"
import { ImagePlus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

interface MultiImageCropUploadProps {
  onImagesSelected: (files: File[]) => void
  onImagesReordered?: (newImageUrls: string[]) => void
  currentImageUrls?: string[]
  label?: string
  required?: boolean
  maxImages?: number
}

interface ImageItem {
  id: string
  url: string
  isExisting: boolean
  file?: File
}

const ASPECT_RATIO = 1 // Square aspect ratio
const MIN_DIMENSION = 150 // Minimum width/height in pixels

/**
 * Component for multiple image uploads with crop functionality and drag & drop reordering
 * Validates file size (max 4MB per file) and format (PNG, JPG, JPEG, GIF, WEBP, SVG, BMP)
 */
export function MultiImageCropUpload({
  onImagesSelected,
  onImagesReordered,
  currentImageUrls = [],
  label = "Images",
  required = false,
  maxImages = 10,
}: MultiImageCropUploadProps) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [error, setError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [currentCropImage, setCurrentCropImage] = useState<string>("")
  const [currentFileName, setCurrentFileName] = useState<string>("")
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Preview dialog state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string>("")

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

  // Load existing images when currentImageUrls changes
  useEffect(() => {
    // Reset new files when loading existing images
    setNewFiles([])

    if (currentImageUrls && currentImageUrls.length > 0) {
      const existingImages: ImageItem[] = currentImageUrls.map((url, index) => {
        const finalUrl = url.startsWith("http") ? url : `${IMG_BASE_URL}${url}`
        return {
          id: `existing-${index}-${url}`,
          url: finalUrl,
          isExisting: true,
        }
      })
      setImages(existingImages)
    } else {
      setImages([])
    }
  }, [JSON.stringify(currentImageUrls)]) // Use JSON.stringify to ensure deep comparison

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    if (!selectedFiles.length) return

    // Check if adding these files would exceed the maximum
    if (images.length + selectedFiles.length > maxImages) {
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

    // Process first file for cropping
    if (selectedFiles.length > 0) {
      const file = selectedFiles[0]
      setCurrentFileName(file.name)

      const reader = new FileReader()
      reader.addEventListener("load", () => {
        const imageUrl = reader.result?.toString() || ""
        setCurrentCropImage(imageUrl)
        setCropDialogOpen(true)
      })
      reader.readAsDataURL(file)
    }

    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget

    // Initialize crop to center square
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 90,
        },
        ASPECT_RATIO,
        width,
        height
      ),
      width,
      height
    )

    setCrop(crop)
  }

  const handleCropComplete = async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return
    }

    const image = imgRef.current
    const canvas = canvasRef.current
    const crop = completedCrop

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return
    }

    const pixelRatio = window.devicePixelRatio || 1

    // Set canvas size
    canvas.width = crop.width * pixelRatio * scaleX
    canvas.height = crop.height * pixelRatio * scaleY

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.imageSmoothingQuality = "high"

    // Draw cropped image
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    )

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to crop image")
          return
        }

        // Create File from blob
        const croppedFile = new File([blob], currentFileName, {
          type: "image/jpeg",
        })

        // Create a preview URL from the blob
        const previewUrl = URL.createObjectURL(blob)

        // Add to images array
        const newImage: ImageItem = {
          id: `new-${Date.now()}-${Math.random()}`,
          url: previewUrl,
          isExisting: false,
          file: croppedFile,
        }

        setImages((prev) => [...prev, newImage])

        // Add to files array and notify parent
        const updatedFiles = [...newFiles, croppedFile]
        setNewFiles(updatedFiles)
        onImagesSelected(updatedFiles)

        // Close dialog and reset
        setCropDialogOpen(false)
        setCurrentCropImage("")
        setCurrentFileName("")
      },
      "image/jpeg",
      0.95
    )
  }

  const handleCancelCrop = () => {
    setCropDialogOpen(false)
    setCurrentCropImage("")
    setCurrentFileName("")
    setError("")
  }

  const handleRemoveImage = (index: number) => {
    const imageToRemove = images[index]

    // Remove image from array
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)

    if (imageToRemove.isExisting) {
      // Notify parent about reordering (even if array is empty)
      if (onImagesReordered) {
        const updatedUrls = newImages
          .filter((img) => img.isExisting)
          .map((img) =>
            img.url.startsWith(IMG_BASE_URL)
              ? img.url.replace(IMG_BASE_URL, "")
              : img.url
          )
        onImagesReordered(updatedUrls)
      }
    } else {
      // Remove from files array
      const updatedFiles = newFiles.filter(
        (file) => file !== imageToRemove.file
      )
      setNewFiles(updatedFiles)
      onImagesSelected(updatedFiles)

      // Release the object URL
      URL.revokeObjectURL(imageToRemove.url)
    }
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const { source, destination } = result
    const sourceIndex = source.index
    const destIndex = destination.index

    // Reorder images
    const newImages = Array.from(images)
    const [removed] = newImages.splice(sourceIndex, 1)
    newImages.splice(destIndex, 0, removed)
    setImages(newImages)

    // If onImagesReordered is provided, notify parent about the change
    if (onImagesReordered) {
      const reorderedUrls = newImages
        .filter((img) => img.isExisting)
        .map((img) =>
          img.url.startsWith(IMG_BASE_URL)
            ? img.url.replace(IMG_BASE_URL, "")
            : img.url
        )

      onImagesReordered(reorderedUrls)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageClick = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl)
    setPreviewDialogOpen(true)
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
          disabled={images.length >= maxImages}
          className="mb-4 w-full"
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Add Images ({images.length}/{maxImages})
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

        {images.length > 0 && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="images" direction="horizontal">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4"
                >
                  {images.map((image, index) => (
                    <Draggable
                      key={image.id}
                      draggableId={image.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="relative group"
                        >
                          <Card className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                            <img
                              src={image.url}
                              alt={`Preview ${index + 1}`}
                              className="object-cover w-full h-32"
                              onClick={() => handleImageClick(image.url)}
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveImage(index)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <div
                              className="p-2 text-center text-xs text-muted-foreground"
                              onClick={() => handleImageClick(image.url)}
                            >
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

        {images.length === 0 && (
          <div className="border-2 border-dashed border-muted rounded-md p-8 text-center">
            <p className="text-muted-foreground">
              No images selected. Click "Add Images" to upload.
            </p>
          </div>
        )}
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
            <DialogDescription>
              Adjust the crop area to create a square image. The selected area
              will be used as the image.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col items-center gap-4 overflow-y-auto py-4">
            {currentCropImage && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT_RATIO}
                minWidth={MIN_DIMENSION}
                minHeight={MIN_DIMENSION}
                circularCrop={false}
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={currentCropImage}
                  onLoad={onImageLoad}
                  className="max-h-[50vh] w-auto"
                />
              </ReactCrop>
            )}

            {/* Hidden canvas for processing cropped image */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={handleCancelCrop}>
              Cancel
            </Button>
            <Button onClick={handleCropComplete}>Apply Crop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>
              Full size preview - Click outside to close
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center p-6 overflow-auto">
            <img
              src={previewImageUrl}
              alt="Full size preview"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>

          <DialogFooter className="px-6 pb-6">
            <Button
              variant="outline"
              onClick={() => setPreviewDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
