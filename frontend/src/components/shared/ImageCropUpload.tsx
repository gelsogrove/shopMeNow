import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useEffect, useRef, useState } from "react"
import ReactCrop, {
  Crop,
  PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { IMG_BASE_URL } from "@/config"

interface ImageCropUploadProps {
  onImageSelected: (file: File) => void
  currentImageUrl?: string
  label?: string
  required?: boolean
}

const ASPECT_RATIO = 1 // Square aspect ratio
const MIN_DIMENSION = 150 // Minimum width/height in pixels

/**
 * Component for image upload with square crop functionality
 * Validates file size (max 4MB) and format (PNG, JPG, JPEG, GIF, WEBP, SVG, BMP)
 */
export function ImageCropUpload({
  onImageSelected,
  currentImageUrl,
  label = "Image",
  required = false,
}: ImageCropUploadProps) {
  const [imgSrc, setImgSrc] = useState<string>("")
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<string>("")
  const [selectedFileName, setSelectedFileName] = useState<string>("")
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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

  // Update preview when component mounts if we have a current image
  useEffect(() => {
    if (currentImageUrl) {
      // If currentImageUrl starts with http, use it directly
      // Otherwise prepend IMG_BASE_URL
      if (currentImageUrl.startsWith('http')) {
        setPreviewImage(currentImageUrl)
      } else {
        setPreviewImage(`${IMG_BASE_URL}${currentImageUrl}`)
      }
    }
  }, [currentImageUrl])

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("File size must be less than 4MB")
      return
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(
        "Invalid file format. Allowed: PNG, JPG, JPEG, GIF, WEBP, SVG, BMP"
      )
      return
    }

    setError("")
    setSelectedFileName(file.name)

    const reader = new FileReader()
    reader.addEventListener("load", () => {
      const imageUrl = reader.result?.toString() || ""
      setImgSrc(imageUrl)
      setDialogOpen(true)
    })
    reader.readAsDataURL(file)
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
        const croppedFile = new File([blob], selectedFileName, {
          type: blob.type,
        })

        // Create a preview URL from the blob
        const previewUrl = URL.createObjectURL(blob)
        setPreviewImage(previewUrl)

        onImageSelected(croppedFile)
        setDialogOpen(false)
        setImgSrc("")

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      },
      "image/jpeg",
      0.95
    )
  }

  const handleCancel = () => {
    setDialogOpen(false)
    setImgSrc("")
    setError("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <Label htmlFor="image-upload">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Preview area */}
        <div className="flex-shrink-0 w-40 h-40 border rounded-md overflow-hidden bg-gray-50 flex items-center justify-center">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Image Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-gray-400 text-sm text-center px-4">No image selected</span>
          )}
        </div>
        
        <div className="flex-grow flex flex-col gap-2">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full justify-start"
          >
            Choose file
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onSelectFile}
            className="hidden"
            id="image-upload"
          />

          {selectedFileName && (
            <p className="text-sm text-muted-foreground">Selected: {selectedFileName}</p>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>

      {/* Crop Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
            <DialogDescription>
              Adjust the crop area to create a square image. The selected area
              will be used as the image.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {imgSrc && (
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
                  src={imgSrc}
                  onLoad={onImageLoad}
                  className="max-h-[60vh] w-auto"
                />
              </ReactCrop>
            )}

            {/* Hidden canvas for processing cropped image */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleCropComplete}>Apply Crop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}