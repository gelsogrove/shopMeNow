#!/usr/bin/env ts-node

import "dotenv/config"
import prisma from "@echatbot/database"
import { DataLoaderService } from "../src/application/data-loader/data-loader.service"
import { SearchProductsIntent } from "../src/application/intent/intent.types"

interface ScriptArgs {
  workspaceId: string
  query: string
  customerId: string
  discount: number
}

function parseArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = {
    workspaceId: "",
    query: "",
    customerId: "script-customer",
    discount: 0,
  }

  argv.forEach((arg) => {
    if (arg.startsWith("--workspace=")) {
      args.workspaceId = arg.split("=")[1] || ""
    } else if (arg.startsWith("--query=")) {
      args.query = arg.substring("--query=".length)
    } else if (arg.startsWith("--customer=")) {
      args.customerId = arg.split("=")[1] || "script-customer"
    } else if (arg.startsWith("--discount=")) {
      const value = Number(arg.split("=")[1])
      if (!Number.isNaN(value)) {
        args.discount = value
      }
    }
  })

  if (!args.workspaceId || !args.query) {
    console.error("Usage: ts-node scripts/test-product-search.ts --workspace=<workspaceId> --query=\"<search text>\" [--customer=<customerId>] [--discount=<number>]")
    process.exit(1)
  }

  return args
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  const dataLoader = new DataLoaderService(prisma)

  try {
    const intent: SearchProductsIntent = { type: "SEARCH_PRODUCTS", query: parsed.query }
    const result = await dataLoader.loadForIntent(intent, parsed.workspaceId, parsed.customerId, parsed.discount)

    console.log("Query:", parsed.query)
    console.log("Workspace:", parsed.workspaceId)

    if (result.type === "PRODUCTS") {
      console.log(`Found ${result.products.length} products:`)
      for (const product of result.products) {
        console.log(`- ${product.name} (SKU: ${product.sku ?? "n/a"})`)
      }
    } else if (result.type === "PRODUCT_DETAIL" && result.product) {
      console.log("Product detail:")
      console.log(`${result.product.name} (SKU: ${result.product.sku ?? "n/a"})`)
    } else {
      console.log("Loaded data:", result)
    }
  } catch (error) {
    console.error("Error running product search:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
