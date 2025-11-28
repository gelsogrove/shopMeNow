import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/hooks/use-workspace"
import { getCurrencySymbol } from "@/utils/format"
import { useEffect, useState } from "react"
import { MultiImageCropUpload } from "./MultiImageCropUpload"

interface Product {
  id: string
  name: string
  description?: string
  price: string
  stock: number
  categoryId?: string | null
  imageUrl?: string[]
  [key: string]: any
}

interface CategoryOption {
  value: string
  label: string
}

interface ProductSheetProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (formData: FormData) => void
  title: string
  availableCategories: CategoryOption[]
}

export function ProductSheet({
  product,
  open,
  onOpenChange,
  onSubmit,
  title,
  availableCategories,
}: ProductSheetProps) {
  const { workspace } = useWorkspace()
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("0")
  const [categoryId, setCategoryId] = useState("")
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])

  // Ottieni il simbolo della valuta dal workspace
  const currencySymbol = getCurrencySymbol(workspace?.currency)

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      setName(product.name || "")
      setDescription(product.description || "")
      setPrice(product.price || "")
      setStock(product.stock?.toString() || "0")
      setCategoryId(product.categoryId || "")
      setImageFiles([])
      setExistingImageUrls(product.imageUrl || [])
    } else {
      // Reset form for new product
      setName("")
      setDescription("")
      setPrice("")
      setStock("0")
      setCategoryId("")
      setImageFiles([])
      setExistingImageUrls([])
    }
  }, [product, open])

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData()
    formData.append("name", name)
    formData.append("description", description)
    formData.append("price", price)
    formData.append("stock", stock)

    if (categoryId) {
      formData.append("categoryId", categoryId)
    }

    // Add multiple image files if selected
    if (imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formData.append("images", file)
      })
    }

    // Add existing image URLs for reordering
    if (existingImageUrls.length > 0) {
      formData.append("existingImageUrls", JSON.stringify(existingImageUrls))
    }

    onSubmit(formData)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[90%] sm:w-[540px] md:w-[700px] p-0 overflow-y-auto"
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>{product ? "Edit Product" : "Add"}</SheetTitle>
            <SheetDescription>
              {product
                ? "Edit an existing product"
                : "Add a new product to your inventory"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Product Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter product description"
                  className="min-h-[120px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Price */}
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium">
                    Price ({currencySymbol})
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Stock */}
                <div className="space-y-2">
                  <Label htmlFor="stock" className="text-sm font-medium">
                    Stock
                  </Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">
                  Categories
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Images */}
              <MultiImageCropUpload
                onImagesSelected={setImageFiles}
                onImagesReordered={setExistingImageUrls}
                currentImageUrls={product?.imageUrl || []}
                label="Product Images"
                required={false}
                maxImages={10}
              />
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t">
            <div className="flex justify-end w-full gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                {product ? "Save Changes" : "Add"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
