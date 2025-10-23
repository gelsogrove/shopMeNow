/**
 * RepeatOrder - LLM-Callable Function
 *
 * Repeats a previous order by adding all its items to the current cart.
 * Used when customer says: "Voglio riordinare", "Ripeti l'ordine", "Riordino", etc.
 *
 * ⚠️ IMPORTANTE: Questa funzione aggiunge al carrello esistente (non lo sostituisce)
 *
 * @see docs/prompt_agent.md - Sezione "repeatOrder()"
 */

import logger from "../../utils/logger"

export interface RepeatOrderRequest {
  customerId: string
  workspaceId: string
  orderCode?: string // Se non specificato, usa ultimo ordine del cliente
}

export interface RepeatOrderResult {
  success: boolean
  message: string
  cartCode?: string // Codice carrello
  orderCode?: string // Codice ordine copiato
  productsAdded?: number // Numero di prodotti aggiunti
  cartUrl?: string // URL pubblico del carrello con token
  expiresAt?: string
  timestamp: string
  error?: string
}

/**
 * Ripete un ordine precedente aggiungendo i prodotti al carrello
 *
 * @param request - Request parameters
 * @returns Result con confirmazione e link carrello
 */
export async function RepeatOrder(
  request: RepeatOrderRequest
): Promise<RepeatOrderResult> {
  try {
    logger.info("🔄 RepeatOrder called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
      orderCode: request.orderCode,
    })

    // Validazione parametri obbligatori
    if (!request.customerId || !request.workspaceId) {
      logger.error("❌ Missing required parameters in RepeatOrder")
      return {
        success: false,
        error: "Parametri richiesti mancanti",
        message: "Impossibile ripetere l'ordine. Parametri incompleti.",
        timestamp: new Date().toISOString(),
      }
    }

    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()

    try {
      // Trova il cliente
      const customer = await prisma.customers.findFirst({
        where: {
          id: request.customerId,
          workspaceId: request.workspaceId,
        },
      })

      if (!customer) {
        logger.error("❌ Customer not found in RepeatOrder")
        return {
          success: false,
          error: "Cliente non trovato",
          message:
            "Ops {{nameUser}}! 😅\n\n" +
            "Non riesco a trovare il tuo account nel sistema. Questo è strano!\n\n" +
            "📞 Contatta il nostro supporto: {{agentPhone}}\n" +
            "📧 Email: {{agentEmail}}\n\n" +
            "Ti aiuteremo subito! 🚀",
          timestamp: new Date().toISOString(),
        }
      }

      // Se orderCode non è specificato, prendi l'ultimo ordine
      let order
      if (request.orderCode) {
        order = await prisma.orders.findFirst({
          where: {
            orderCode: request.orderCode,
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
          include: {
            items: {
              include: {
                product: true,
                service: true,
              },
            },
          },
        })
      } else {
        // Prendi l'ultimo ordine (più recente)
        order = await prisma.orders.findFirst({
          where: {
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            items: {
              include: {
                product: true,
                service: true,
              },
            },
          },
        })
      }

      if (!order || !order.items || order.items.length === 0) {
        logger.error("❌ No order found to repeat")
        return {
          success: false,
          error: "Nessun ordine trovato",
          message:
            "Ciao {{nameUser}}! 👋\n\n" +
            "Non trovo ordini precedenti da ripetere. È la prima volta che ordini da noi? 🎉\n\n" +
            "Nessun problema! Dai un'occhiata alle nostre **offerte speciali** e ai prodotti disponibili!\n\n" +
            "💡 Hai uno sconto del **{{discountUser}}%** su tutti i prodotti! 🛍️\n\n" +
            "Cosa ti piacerebbe ordinare oggi? 😊",
          timestamp: new Date().toISOString(),
        }
      }

      // Svuota il carrello esistente (opzionale, per ricominciare pulito)
      let cart = await prisma.carts.findFirst({
        where: {
          customerId: request.customerId,
          workspaceId: request.workspaceId,
        },
      })

      if (!cart) {
        // Crea carrello se non esiste
        cart = await prisma.carts.create({
          data: {
            customerId: request.customerId,
            workspaceId: request.workspaceId,
          },
        })
      }

      // Opzionale: svuota il carrello prima di aggiungere i nuovi prodotti
      // Commenta questa sezione se vuoi aggiungere ai prodotti esistenti
      await prisma.cartItems.deleteMany({
        where: {
          cartId: cart.id,
        },
      })

      // Aggiungi tutti i prodotti/servizi dell'ordine al carrello
      // Raggruppa prodotti per codice e somma le quantità
      let productsAdded = 0
      const productGroups: Record<string, { item: any; totalQty: number }> = {}
      const serviceGroups: Record<string, { item: any; totalQty: number }> = {}

      for (const item of order.items) {
        if (item.itemType === "PRODUCT" && item.product) {
          const code = item.product.productCode // 🔧 FIX: Use productCode, not code
          if (!code) {
            logger.warn(
              `⚠️ Product ${item.product.name} has no productCode, skipping`
            )
            continue
          }
          if (!productGroups[code]) {
            productGroups[code] = { item, totalQty: 0 }
          }
          productGroups[code].totalQty += item.quantity
        } else if (item.itemType === "SERVICE" && item.service) {
          const code = item.service.code // ✅ Services use 'code'
          if (!code) {
            logger.warn(`⚠️ Service ${item.service.name} has no code, skipping`)
            continue
          }
          if (!serviceGroups[code]) {
            serviceGroups[code] = { item, totalQty: 0 }
          }
          serviceGroups[code].totalQty += item.quantity
        }
      }

      // Aggiungi prodotti raggruppati (o aggiorna quantità se già presente)
      for (const code in productGroups) {
        const { item, totalQty } = productGroups[code]
        const product = await prisma.products.findFirst({
          where: {
            productCode: code, // 🔧 FIX: Use productCode field
            workspaceId: request.workspaceId,
          },
        })
        if (product && product.stock > 0) {
          // 🔧 FIX: Check if product already exists in cart
          const existingCartItem = await prisma.cartItems.findFirst({
            where: {
              cartId: cart.id,
              productId: product.id,
              itemType: "PRODUCT",
            },
          })

          if (existingCartItem) {
            // Update existing quantity
            await prisma.cartItems.update({
              where: { id: existingCartItem.id },
              data: { quantity: existingCartItem.quantity + totalQty },
            })
            logger.info(
              `✅ Updated product ${product.code} (${product.name}): ${existingCartItem.quantity} + ${totalQty} = ${existingCartItem.quantity + totalQty}`
            )
          } else {
            // Create new cart item
            await prisma.cartItems.create({
              data: {
                cartId: cart.id,
                productId: product.id,
                quantity: totalQty,
                itemType: "PRODUCT",
                notes: item.notes,
              },
            })
            logger.info(
              `✅ Added product ${product.productCode} (${product.name}) x${totalQty} to cart`
            )
          }
          productsAdded++
        } else {
          logger.warn(`⚠️ Product ${code} not found or out of stock`)
        }
      }

      // Aggiungi servizi raggruppati (o aggiorna quantità se già presente)
      for (const code in serviceGroups) {
        const { item, totalQty } = serviceGroups[code]
        const service = await prisma.services.findFirst({
          where: {
            code,
            workspaceId: request.workspaceId,
          },
        })
        if (service) {
          // 🔧 FIX: Check if service already exists in cart
          const existingCartItem = await prisma.cartItems.findFirst({
            where: {
              cartId: cart.id,
              serviceId: service.id,
              itemType: "SERVICE",
            },
          })

          if (existingCartItem) {
            // Update existing quantity
            await prisma.cartItems.update({
              where: { id: existingCartItem.id },
              data: { quantity: existingCartItem.quantity + totalQty },
            })
            logger.info(
              `✅ Updated service ${service.code} (${service.name}): ${existingCartItem.quantity} + ${totalQty} = ${existingCartItem.quantity + totalQty}`
            )
          } else {
            // Create new cart item
            await prisma.cartItems.create({
              data: {
                cartId: cart.id,
                serviceId: service.id,
                quantity: totalQty,
                itemType: "SERVICE",
                notes: item.notes,
              },
            })
            logger.info(
              `✅ Added service ${service.code} (${service.name}) x${totalQty} to cart`
            )
          }
          productsAdded++
        } else {
          logger.warn(`⚠️ Service ${code} not found`)
        }
      }

      // Genera link carrello con token sicuro usando il servizio centralizzato
      const CallingFunctionsService =
        require("../../services/calling-functions.service").CallingFunctionsService
      const callingFunctionsService = new CallingFunctionsService()

      const cartLinkResult = await callingFunctionsService.getCartLink({
        customerId: request.customerId,
        workspaceId: request.workspaceId,
      })

      if (!cartLinkResult.success || !cartLinkResult.linkUrl) {
        logger.error("❌ Failed to generate cart link in RepeatOrder")
        await prisma.$disconnect()

        return {
          success: false,
          error: "Errore generazione link carrello",
          message:
            "Si è verificato un errore durante la generazione del link. Riprova.",
          timestamp: new Date().toISOString(),
        }
      }

      const cartUrl = cartLinkResult.linkUrl
      const token = cartLinkResult.token

      await prisma.$disconnect()

      logger.info("✅ RepeatOrder success: added", productsAdded, "products")
      return {
        success: true,
        message:
          `Perfetto {{nameUser}}! ✅\n\n` +
          `Ho aggiunto **${productsAdded} prodotto/i** dal tuo ultimo ordine (${order.orderCode}) al carrello! 🛒\n\n` +
          `🛒 **Vai al checkout**:\n` +
          `[LINK_CHECKOUT_WITH_TOKEN]\n\n` +
          `⏰ Link valido per {{TOKEN_DURATION}}\n\n` +
          `💡 **Ricorda**: hai uno sconto del **{{discountUser}}%** applicato automaticamente! 🎉\n\n` +
          `Vuoi procedere con l'ordine o modificare qualcosa? 😊`,
        cartCode: cart.id,
        orderCode: order.orderCode,
        productsAdded,
        cartUrl,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 ora
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error("❌ Error in RepeatOrder database operations:", error)
      await prisma.$disconnect()

      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore del database",
        message:
          "Ops {{nameUser}}! 😅\n\n" +
          "Si è verificato un problema tecnico durante il ripristino del tuo ordine.\n\n" +
          "Non preoccuparti! Puoi:\n" +
          "• Riprovare tra qualche minuto ⏰\n" +
          "• Fare un nuovo ordine manualmente 🛍️\n" +
          "• Contattare il supporto: {{agentPhone}} 📞\n\n" +
          "Ci scusiamo per l'inconveniente! 🙏",
        timestamp: new Date().toISOString(),
      }
    }
  } catch (error) {
    logger.error("❌ Error in RepeatOrder:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore interno",
      message:
        "Ops {{nameUser}}! 😅\n\n" +
        "Si è verificato un problema tecnico durante il ripristino del tuo ordine.\n\n" +
        "Non preoccuparti! Puoi:\n" +
        "• Riprovare tra qualche minuto ⏰\n" +
        "• Fare un nuovo ordine manualmente 🛍️\n" +
        "• Contattare il supporto: {{agentPhone}} 📞\n\n" +
        "Ci scusiamo per l'inconveniente! 🙏",
      timestamp: new Date().toISOString(),
    }
  }
}
