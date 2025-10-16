import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function check() {
  const products = await prisma.products.findMany({
    select: { id: true, name: true, ProductCode: true, imageUrl: true },
  })

  const withImages = products.filter((p) => p.imageUrl && p.imageUrl.length > 0)
  const withoutImages = products.filter(
    (p) => !p.imageUrl || p.imageUrl.length === 0
  )

  console.log(`\n📊 STATISTICHE:`)
  console.log(`   Totale prodotti: ${products.length}`)
  console.log(`   Con immagini: ${withImages.length}`)
  console.log(`   Senza immagini: ${withoutImages.length}`)

  console.log(`\n✅ PRODOTTI CON IMMAGINI (primi 10):`)
  withImages.slice(0, 10).forEach((p) => {
    console.log(`  - ${p.ProductCode}: ${p.name}`)
    console.log(`    imageUrl: ${p.imageUrl[0]}`)
  })

  await prisma.$disconnect()
}

check()
