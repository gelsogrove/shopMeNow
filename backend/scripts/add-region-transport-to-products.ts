/**
 * Script per aggiungere region e transportType ai prodotti in products.ts
 * Usa la logica esistente dal seed per popolare i campi
 */

import fs from "fs"
import path from "path"
import { products } from "../prisma/data/products"

// Funzione per determinare transportType (copiata da seed.ts)
function getTransportType(productName: string, categoryName: string): string {
  let transportType = "Temperatura ambiente" // Default

  // Refrigerated products (fresh meats, cheeses, dairy)
  if (
    categoryName === "Cured Meats" ||
    categoryName === "Cheeses" ||
    productName.toLowerCase().includes("burrata") ||
    productName.toLowerCase().includes("prosciutto") ||
    productName.toLowerCase().includes("guanciale") ||
    productName.toLowerCase().includes("pancetta") ||
    productName.toLowerCase().includes("ricotta")
  ) {
    transportType = "Trasporto refrigerato"
  }

  // Frozen products (gelato, arancini, frozen pasta)
  if (
    productName.toLowerCase().includes("gelato") ||
    productName.toLowerCase().includes("arancini") ||
    productName.toLowerCase().includes("frozen") ||
    productName.toLowerCase().includes("congelat")
  ) {
    transportType = "Trasporto congelato"
  }

  return transportType
}

// Funzione per determinare region (copiata da seed.ts)
function getRegion(productName: string): string | null {
  const prodNameLower = productName.toLowerCase()

  if (
    prodNameLower.includes("parmigiano") ||
    prodNameLower.includes("parma") ||
    prodNameLower.includes("modena")
  ) {
    return "Emilia-Romagna"
  } else if (
    prodNameLower.includes("romano") ||
    prodNameLower.includes("roma")
  ) {
    return "Lazio"
  } else if (
    prodNameLower.includes("sardo") ||
    prodNameLower.includes("pecorino sardo") ||
    prodNameLower.includes("sardinia")
  ) {
    return "Sardinia"
  } else if (
    prodNameLower.includes("mozzarella") ||
    prodNameLower.includes("buffalo") ||
    prodNameLower.includes("napoli") ||
    prodNameLower.includes("sorrento")
  ) {
    return "Campania"
  } else if (
    prodNameLower.includes("gorgonzola") ||
    prodNameLower.includes("milan") ||
    prodNameLower.includes("panettone")
  ) {
    return "Lombardy"
  } else if (
    prodNameLower.includes("toscano") ||
    prodNameLower.includes("tuscan") ||
    prodNameLower.includes("chianti") ||
    prodNameLower.includes("florence")
  ) {
    return "Tuscany"
  } else if (
    prodNameLower.includes("sicilian") ||
    prodNameLower.includes("sicilia") ||
    prodNameLower.includes("etna") ||
    prodNameLower.includes("arancini")
  ) {
    return "Sicily"
  } else if (
    prodNameLower.includes("piedmont") ||
    prodNameLower.includes("barolo") ||
    prodNameLower.includes("alba") ||
    prodNameLower.includes("tartufo")
  ) {
    return "Piedmont"
  } else if (
    prodNameLower.includes("venice") ||
    prodNameLower.includes("veneto") ||
    prodNameLower.includes("prosecco")
  ) {
    return "Veneto"
  } else if (
    prodNameLower.includes("puglia") ||
    prodNameLower.includes("apulia") ||
    prodNameLower.includes("orecchiette")
  ) {
    return "Apulia"
  } else if (
    prodNameLower.includes("calabria") ||
    prodNameLower.includes("calabrese") ||
    prodNameLower.includes("bergamot")
  ) {
    return "Calabria"
  } else if (
    prodNameLower.includes("liguria") ||
    prodNameLower.includes("genoa") ||
    prodNameLower.includes("pesto")
  ) {
    return "Liguria"
  } else if (
    prodNameLower.includes("marche") ||
    prodNameLower.includes("ancona")
  ) {
    return "Marche"
  } else if (
    prodNameLower.includes("abruzzo") ||
    prodNameLower.includes("montepulciano d'abruzzo")
  ) {
    return "Abruzzo"
  } else if (
    prodNameLower.includes("friuli") ||
    prodNameLower.includes("venezia giulia")
  ) {
    return "Friuli-Venezia Giulia"
  } else if (
    prodNameLower.includes("trentino") ||
    prodNameLower.includes("alto adige") ||
    prodNameLower.includes("south tyrol")
  ) {
    return "Trentino-South Tyrol"
  } else if (
    prodNameLower.includes("umbria") ||
    prodNameLower.includes("perugia") ||
    prodNameLower.includes("norcia")
  ) {
    return "Umbria"
  } else if (
    prodNameLower.includes("basilicata") ||
    prodNameLower.includes("matera")
  ) {
    return "Basilicata"
  } else if (prodNameLower.includes("molise")) {
    return "Molise"
  } else if (
    prodNameLower.includes("valle d'aosta") ||
    prodNameLower.includes("fontina")
  ) {
    return "Aosta Valley"
  } else if (prodNameLower.includes("gragnano")) {
    return "Campania"
  }

  return null
}

// Aggiungi region e transportType a ogni prodotto
const updatedProducts = products.map((prod) => {
  const region = getRegion(prod.name)
  const transportType = getTransportType(prod.name, prod.categoryName)

  return {
    ...prod,
    region: region || undefined,
    transportType:
      transportType !== "Temperatura ambiente" ? transportType : undefined,
  }
})

// Genera il nuovo file products.ts
const header = `/**
 * Product Data - Auto-generated from database
 * Last updated: ${new Date().toISOString()}
 * Updated with region and transportType fields
 */

export interface ProductData {
  name: string
  ProductCode?: string
  description: string
  formato: string
  price: number
  stock: number
  status: string
  slug: string
  categoryName: string
  region?: string // Italian region in English (e.g., "Emilia-Romagna", "Tuscany")
  transportType?: string // "Trasporto refrigerato", "Trasporto congelato", "Temperatura ambiente"
  imageUrl?: string[]
}

export const products: ProductData[] = `

const productsJson = JSON.stringify(updatedProducts, null, 2)
const content = header + productsJson

// Backup del file originale
const productsPath = path.join(__dirname, "../prisma/data/products.ts")
const backupPath = path.join(
  __dirname,
  "../prisma/data/products.ts.backup." + Date.now()
)
fs.copyFileSync(productsPath, backupPath)
console.log(`✅ Backup created: ${backupPath}`)

// Scrivi il nuovo file
fs.writeFileSync(productsPath, content, "utf-8")
console.log(`✅ Updated products.ts with region and transportType`)
console.log(`\n📊 Statistics:`)
console.log(`   - Total products: ${updatedProducts.length}`)
console.log(
  `   - With region: ${updatedProducts.filter((p) => p.region).length}`
)
console.log(
  `   - With custom transport: ${updatedProducts.filter((p) => p.transportType && p.transportType !== "Temperatura ambiente").length}`
)
