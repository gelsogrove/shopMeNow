import { Search, X } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import { mobileClasses } from "../../styles/theme"

interface SearchBarProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  className?: string
  autoFocus?: boolean
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Cerca prodotti...",
  value,
  onChange,
  onClear,
  className = "",
  autoFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleClear = () => {
    onChange("")
    if (onClear) onClear()
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search Icon */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search
          className={`h-5 w-5 transition-colors ${
            isFocused ? "text-primary-500" : "text-neutral-400"
          }`}
        />
      </div>

      {/* Search Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={`${mobileClasses.searchInput} ${
          isFocused ? "ring-2 ring-primary-500 bg-white" : "bg-neutral-50"
        }`}
        style={{
          paddingLeft: "2.5rem",
          paddingRight: value ? "2.5rem" : "1rem",
        }}
      />

      {/* Clear Button */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-neutral-100 rounded-r-lg transition-colors"
          aria-label="Cancella ricerca"
        >
          <X className="h-5 w-5 text-neutral-400 hover:text-neutral-600" />
        </button>
      )}
    </div>
  )
}

// Hook per filtrare i prodotti
export const useProductSearch = <T extends Record<string, any>>(
  products: T[],
  searchTerm: string,
  searchFields: (keyof T)[] = ["descrizione", "codice", "nome", "name"]
) => {
  const [filteredProducts, setFilteredProducts] = useState<T[]>(products)

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products)
      return
    }

    const searchLower = searchTerm.toLowerCase().trim()
    const filtered = products.filter((product) => {
      return searchFields.some((field) => {
        const value = product[field]
        if (typeof value === "string") {
          return value.toLowerCase().includes(searchLower)
        }
        return false
      })
    })

    setFilteredProducts(filtered)
  }, [products, searchTerm, searchFields])

  return filteredProducts
}
