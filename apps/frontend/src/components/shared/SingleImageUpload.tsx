import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { IMG_BASE_URL } from "@/config"
import { ImagePlus, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface SingleImageUploadProps {
  onImageSelected: (file: File | null) => void
  currentImageUrl?: string
  label?: string
  required?: boolean
  shape?: "square" | "circle"
  size?: "sm" | "md" | "lg"
}

export function SingleImageUpload({
  onImageSelected,
  currentImageUrl,
  label = "Image",
  required = false,
  shape = "square",
  size = "md",
}: SingleImageUploadProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [error, setError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB
  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  }

  useEffect(() => {
    if (currentImageUrl) {
      const formattedUrl = currentImageUrl.startsWith("http")
        ? currentImageUrl
        : `${IMG_BASE_URL}${currentImageUrl}`
      setPreviewUrl(formattedUrl)
    }
  }, [currentImageUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setError("File must be less than 4MB")
      return
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PNG, JPG, JPEG, GIF, and WEBP formats are allowed")
      return
    }

    setError("")
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    onImageSelected(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemove = () => {
    if (previewUrl && !previewUrl.startsWith(IMG_BASE_URL)) {
      URL.revokeObjectURL(previewUrl)
    }
    setImageFile(null)
    setPreviewUrl("")
    onImageSelected(null)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="grid w-full items-center gap-1.5">
      {label && (
        <Label>
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      <div className="flex items-center gap-4">
        {previewUrl ? (
          <div className="relative group">
            <img
              src={previewUrl}
              alt="Preview"
              className={`${sizeClasses[size]} object-cover ${shape === "circle" ? "rounded-full" : "rounded-lg"} border-2 border-gray-200`}
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div
            onClick={handleUploadClick}
            className={`${sizeClasses[size]} ${shape === "circle" ? "rounded-full" : "rounded-lg"} border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors`}
          >
            <ImagePlus className="h-6 w-6 text-gray-400" />
          </div>
        )}

        <div className="flex-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleUploadClick}
            size="sm"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            {previewUrl ? "Change Image" : "Upload Image"}
          </Button>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
