/**
 * INCREMENTAL SEED - Updates database without destroying existing data
 * 
 * This script:
 * - DOES NOT delete existing data
 * - Updates only if changes detected
 * - Preserves user-created content (products, categories, etc.)
 * - Safe to run multiple times
 * 
 * Usage: npm run seed:update
 */

import { PrismaClient } from "@prisma/client"
import { foodCategories } from "../prisma/data/categories"
import { products } from "../prisma/data/products"

const prisma = new PrismaClient()

async function incrementalSeed() {
  console.log("🔄 INCREMENTAL SEED - Updating database safely...")
  console.log("=" .repeat(50))

  try {
    // 1. Get main workspace
    const workspace = await prisma.workspace.findFirst({
      where: { name: "L'Altra Italia(ESP)" },
    })

    if (!workspace) {
      console.error("❌ Workspace not found! Run full seed first: npm run seed")
      process.exit(1)
    }

    console.log(`✅ Working with workspace: ${workspace.name}`)

    // 2. Update/Create Categories
    console.log("\n📁 Updating categories...")
    let categoriesUpdated = 0
    let categoriesCreated = 0

    for (const cat of foodCategories) {
      const existing = await prisma.categories.findFirst({
        where: {
          slug: cat.slug,
          workspaceId: workspace.id,
        },
      })

      if (existing) {
        // Update only if changed
        const hasChanges =
          existing.name !== cat.name ||
          existing.description !== cat.description

        if (hasChanges) {
          await prisma.categories.update({
            where: { id: existing.id },
            data: {
              name: cat.name,
              description: cat.description,
            },
          })
          categoriesUpdated++
          console.log(`  ↻ Updated: ${cat.name}`)
        } else {
          console.log(`  ✓ No changes: ${cat.name}`)
        }
      } else {
        await prisma.categories.create({
          data: {
            name: cat.name,
            description: cat.description,
            slug: cat.slug,
            workspaceId: workspace.id,
            isActive: true,
          },
        })
        categoriesCreated++
        console.log(`  + Created: ${cat.name}`)
      }
    }

    console.log(
      `📊 Categories: ${categoriesCreated} created, ${categoriesUpdated} updated`
    )

    // 3. Update/Create Products
    console.log("\n📦 Updating products...")
    let productsUpdated = 0
    let productsCreated = 0
    let productsSkipped = 0

    for (const prod of products) {
      // Find category
      const category = await prisma.categories.findFirst({
        where: {
          name: prod.categoryName,
          workspaceId: workspace.id,
        },
      })

      if (!category) {
        console.log(`  ⚠️ Category not found for: ${prod.name}`)
        productsSkipped++
        continue
      }

      // Check if product exists by ProductCode
      const existing = await prisma.products.findFirst({
        where: {
          ProductCode: prod.ProductCode,
          workspaceId: workspace.id,
        },
      })

      if (existing) {
        // Update only if changed
        const hasChanges =
          existing.name !== prod.name ||
          existing.description !== prod.description ||
          existing.price !== prod.price ||
          existing.stock !== prod.stock ||
          existing.formato !== prod.formato

        if (hasChanges) {
          await prisma.products.update({
            where: { id: existing.id },
            data: {
              name: prod.name,
              description: prod.description,
              price: prod.price,
              stock: prod.stock,
              formato: prod.formato,
              categoryId: category.id,
              // Keep existing images and isActive status
            },
          })
          productsUpdated++
          console.log(`  ↻ Updated: ${prod.name}`)
        } else {
          console.log(`  ✓ No changes: ${prod.name}`)
        }
      } else {
        await prisma.products.create({
          data: {
            name: prod.name,
            ProductCode: prod.ProductCode,
            description: prod.description,
            formato: prod.formato || "",
            price: prod.price,
            stock: prod.stock,
            status: "ACTIVE",
            isActive: true,
            slug: `${prod.slug}-${Date.now()}`,
            workspaceId: workspace.id,
            categoryId: category.id,
          },
        })
        productsCreated++
        console.log(`  + Created: ${prod.name}`)
      }
    }

    console.log(
      `📊 Products: ${productsCreated} created, ${productsUpdated} updated, ${productsSkipped} skipped`
    )

    console.log("\n" + "=".repeat(50))
    console.log("✅ INCREMENTAL SEED COMPLETED!")
    console.log("   - Existing data preserved")
    console.log("   - Updates applied where needed")
    console.log("   - Safe to run anytime")
  } catch (error) {
    console.error("❌ Error during incremental seed:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

incrementalSeed()
  .then(() => {
    console.log("\n🎉 Done!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
