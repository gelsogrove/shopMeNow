import { createContext, ReactNode, useContext, useState } from "react"

// 📊 Dati originali del cliente da tracciare
export interface OriginalCustomerData {
  discount: number
  activeChatbot: boolean
  isBlacklisted: boolean
}

interface CustomerEditContextType {
  // Salva dati originali quando selezioni un cliente
  saveOriginalCustomerData: (
    customerId: string,
    data: OriginalCustomerData
  ) => void

  // Recupera dati originali per confronto
  getOriginalCustomerData: (customerId: string) => OriginalCustomerData | null

  // Pulisci dopo cambio chat
  clearOriginalCustomerData: (customerId: string) => void

  // Pulisci tutti i dati (quando cambi workspace)
  clearAllOriginalData: () => void
}

const CustomerEditContext = createContext<CustomerEditContextType | undefined>(
  undefined
)

export function CustomerEditProvider({ children }: { children: ReactNode }) {
  // 🗄️ Map in memoria: customerId → OriginalCustomerData
  const [originalDataMap, setOriginalDataMap] = useState<
    Map<string, OriginalCustomerData>
  >(new Map())

  const saveOriginalCustomerData = (
    customerId: string,
    data: OriginalCustomerData
  ) => {
    setOriginalDataMap((prev) => {
      const newMap = new Map(prev)
      newMap.set(customerId, data)
      return newMap
    })
  }

  const getOriginalCustomerData = (
    customerId: string
  ): OriginalCustomerData | null => {
    return originalDataMap.get(customerId) || null
  }

  const clearOriginalCustomerData = (customerId: string) => {
    setOriginalDataMap((prev) => {
      const newMap = new Map(prev)
      newMap.delete(customerId)
      return newMap
    })
  }

  const clearAllOriginalData = () => {
    setOriginalDataMap(new Map())
  }

  return (
    <CustomerEditContext.Provider
      value={{
        saveOriginalCustomerData,
        getOriginalCustomerData,
        clearOriginalCustomerData,
        clearAllOriginalData,
      }}
    >
      {children}
    </CustomerEditContext.Provider>
  )
}

// 🪝 Custom hook per usare il context
export function useCustomerEdit() {
  const context = useContext(CustomerEditContext)
  if (context === undefined) {
    throw new Error(
      "useCustomerEdit must be used within a CustomerEditProvider"
    )
  }
  return context
}
