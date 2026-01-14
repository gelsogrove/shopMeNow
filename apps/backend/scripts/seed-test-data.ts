import { prisma } from "@echatbot/database";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding test data...");

  try {
    // ============================================
    // 1. Create admin@echatbot.ai user (default login)
    // ============================================
    const adminPassword = await bcrypt.hash("venezia44", 10);
    let adminUser = await prisma.user.findFirst({
      where: { email: "admin@echatbot.ai" },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: "admin@echatbot.ai",
          passwordHash: adminPassword,
          firstName: "Admin",
          lastName: "eChatbot",
        },
      });
      console.log("✅ Created admin user: admin@echatbot.ai");
    } else {
      // Update password in case it changed
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { passwordHash: adminPassword },
      });
      console.log("✅ Admin user exists, password updated: admin@echatbot.ai");
    }

    // ============================================
    // 2. Find or create test workspace
    // ============================================
    let workspace = await prisma.workspace.findUnique({
      where: { slug: "bell-italia-vip" },
    });

    if (workspace?.ownerId) {
      console.log("✅ Test workspace already exists with owner:", workspace.name);
    } else {
      // Create owner (or use existing one)
      let owner = await prisma.user.findFirst({
        where: { email: "admin@bellitalia.it" },
      });

      if (!owner) {
        owner = await prisma.user.create({
          data: {
            email: "admin@bellitalia.it",
            passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoSye",
            firstName: "Admin",
            lastName: "BellItalia",
          },
        });
        console.log("✅ Created test owner user:", owner.email);
      }

      // Update workspace with owner using upsert (by slug)
      workspace = await prisma.workspace.upsert({
        where: { slug: "bell-italia-vip" },
        create: {
          id: "bellitalia-vip-ecommerce", // Fixed ID for consistent testing
          name: "BellItalia VIP",
          slug: "bell-italia-vip",
          whatsappPhoneNumber: "+393334567890",
          notificationEmail: "support@bellitalia.it",
          isActive: true,
          language: "IT",
          ownerId: owner.id,
          channelStatus: true,
          sellsProductsAndServices: true,
          welcomeMessage: {
            it: "Benvenuto! 👋 Sono SofiA, il tuo assistente digitale.\n\n✨ Posso aiutarti a:\n• Scoprire i nostri prodotti gourmet italiani\n• Rispondere alle tue domande\n• Gestire i tuoi ordini\n\n📢 **Se vuoi ricevere news e offerte esclusive, registrati qui!** 👉 https://bellitalia.com/register\n\nCome posso aiutarti? 😊",
            en: "Welcome! 👋 I'm SofiA, your digital assistant.\n\n✨ I can help you:\n• Discover our Italian gourmet products\n• Answer your questions\n• Manage your orders\n\n📢 **If you want to receive exclusive news and offers, register here!** 👉 https://bellitalia.com/register\n\nHow can I help you? 😊",
            es: "¡Bienvenido! 👋 Soy SofiA, tu asistente digital.\n\n✨ Puedo ayudarte a:\n• Descubrir nuestros productos gourmet italianos\n• Responder tus preguntas\n• Gestionar tus pedidos\n\n📢 **¡Si quieres recibir noticias y ofertas exclusivas, regístrate aquí!** 👉 https://bellitalia.com/register\n\n¿Cómo puedo ayudarte? 😊",
          },
          customAiRules: `# 🎯 REGOLE AI PERSONALIZZATE PER BELLITALIA

## 🔄 OGNI 10 MESSAGGI: INVITA ALLA REGISTRAZIONE
Ogni decimo messaggio che invii, includi un link di registrazione così:

---
📢 **Non vuoi perderti le nostre news e offerte esclusive?**
🎁 Registrati e riceverai sconti speciali e anteprima prodotti!
👉 [Registrati Qui](https://bellitalia.com/register)

---

## 📝 LINEE GUIDA FORMATTAZIONE

### ✨ SEMPRE USA:
- **Bold** per concetti importanti
- • Bullet points per liste
- Emoticon per conferme (✅), spedizioni (📦), domande (❓)
- Frasi brevi (max 130 parole per risposta)

### 🎨 ESEMPI:

**Risposta Prodotti:**
"Abbiamo 3 formaggi perfetti per te:
• **Parmigiano Reggiano** - 12,50€ (stagionato 24 mesi) 🧀
• **Burrata** - 7,50€ (fresco e cremoso) ✨
• **Taleggio DOP** - 11€ (morbido e aromatico) 🥰"

**Ordine Spedito:**
"Perfetto! ✅ Il tuo ordine #123 è in viaggio 📦
Arriverà entro 2-3 giorni."

### ❌ MAI FARE:
- Emoji in liste prezzi/carrello
- Modificare numeri/prezzi
- Inventare prodotti
- Frasi lunghe >130 parole

## 🎭 PERSONALITÀ
Sei SofiA: Amichevole, entusiasta dei prodotti italiani, sempre pronta ad aiutare.`,
        },
        update: {
          ownerId: owner.id,
          channelStatus: true,
          sellsProductsAndServices: true,
          debugMode: false,
          welcomeMessage: {
            it: "Benvenuto! 👋 Sono SofiA, il tuo assistente digitale.\n\n✨ Posso aiutarti a:\n• Scoprire i nostri prodotti gourmet italiani\n• Rispondere alle tue domande\n• Gestire i tuoi ordini\n\n📢 **Se vuoi ricevere news e offerte esclusive, registrati qui!** 👉 https://bellitalia.com/register\n\nCome posso aiutarti? 😊",
            en: "Welcome! 👋 I'm SofiA, your digital assistant.\n\n✨ I can help you:\n• Discover our Italian gourmet products\n• Answer your questions\n• Manage your orders\n\n📢 **If you want to receive exclusive news and offers, register here!** 👉 https://bellitalia.com/register\n\nHow can I help you? 😊",
            es: "¡Bienvenido! 👋 Soy SofiA, tu asistente digital.\n\n✨ Puedo ayudarte a:\n• Descubrir nuestros productos gourmet italianos\n• Responder tus preguntas\n• Gestionar tus pedidos\n\n📢 **¡Si quieres recibir noticias y ofertas exclusivas, regístrate aquí!** 👉 https://bellitalia.com/register\n\n¿Cómo puedo ayudarte? 😊",
          },
          customAiRules: `# 🎯 REGOLE AI PERSONALIZZATE PER BELLITALIA

## 🔄 OGNI 10 MESSAGGI: INVITA ALLA REGISTRAZIONE
Ogni decimo messaggio che invii, includi un link di registrazione così:

---
📢 **Non vuoi perderti le nostre news e offerte esclusive?**
🎁 Registrati e riceverai sconti speciali e anteprima prodotti!
👉 [Registrati Qui](https://bellitalia.com/register)

---

## 📝 LINEE GUIDA FORMATTAZIONE

### ✨ SEMPRE USA:
- **Bold** per concetti importanti
- • Bullet points per liste
- Emoticon per conferme (✅), spedizioni (📦), domande (❓)
- Frasi brevi (max 130 parole per risposta)

### 🎨 ESEMPI:

**Risposta Prodotti:**
"Abbiamo 3 formaggi perfetti per te:
• **Parmigiano Reggiano** - 12,50€ (stagionato 24 mesi) 🧀
• **Burrata** - 7,50€ (fresco e cremoso) ✨
• **Taleggio DOP** - 11€ (morbido e aromatico) 🥰"

**Ordine Spedito:**
"Perfetto! ✅ Il tuo ordine #123 è in viaggio 📦
Arriverà entro 2-3 giorni."

### ❌ MAI FARE:
- Emoji in liste prezzi/carrello
- Modificare numeri/prezzi
- Inventare prodotti
- Frasi lunghe >130 parole

## 🎭 PERSONALITÀ
Sei SofiA: Amichevole, entusiasta dei prodotti italiani, sempre pronta ad aiutare.`,
        },
      });
      console.log("✅ Workspace ready:", workspace.name);

      // Ensure owner is in UserWorkspace
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: { userId_workspaceId: { userId: owner.id, workspaceId: workspace.id } },
      });

      if (!userWorkspace) {
        await prisma.userWorkspace.create({
          data: {
            userId: owner.id,
            workspaceId: workspace.id,
            role: "SUPER_ADMIN",
          },
        });
        console.log("✅ Added owner to workspace");
      }
    }

    // Ensure admin@echatbot.ai has access to the workspace
    const adminWorkspace = await prisma.userWorkspace.findUnique({
      where: { userId_workspaceId: { userId: adminUser.id, workspaceId: workspace.id } },
    });

    if (!adminWorkspace) {
      await prisma.userWorkspace.create({
        data: {
          userId: adminUser.id,
          workspaceId: workspace.id,
          role: "SUPER_ADMIN",
        },
      });
      console.log("✅ Added admin@echatbot.ai to workspace");
    }

    // Create test customer - Mario Rossi
    const customer = await prisma.customers.create({
      data: {
        phone: "+390212345678",
        email: "mario.rossi@example.com",
        name: "Mario Rossi",
        workspaceId: workspace.id,
        language: "IT",
      },
    });

    console.log("✅ Created test customer:", customer.name);

    // Create or update sample products
    const products = await Promise.all([
      prisma.products.upsert({
        where: { slug: "parmigiano-reggiano-dop" },
        create: {
          workspaceId: workspace.id,
          name: "Parmigiano Reggiano DOP",
          sku: "FORMAG-001",
          slug: "parmigiano-reggiano-dop",
          description: "Formaggio stagionato 24 mesi da Parma",
          price: 12.5,
          stock: 50,
          region: "Parma, Italia",
          certifications: ["DOP"],
          isActive: true,
        },
        update: {
          name: "Parmigiano Reggiano DOP",
          price: 12.5,
          stock: 50,
        },
      }),
      prisma.products.upsert({
        where: { slug: "mozzarella-bufala" },
        create: {
          workspaceId: workspace.id,
          name: "Mozzarella di Bufala",
          sku: "FORMAG-002",
          slug: "mozzarella-bufala",
          description: "Mozzarella fresca campana, 250g",
          price: 8.9,
          stock: 100,
          region: "Campania, Italia",
          certifications: ["DOP"],
          isActive: true,
        },
        update: {
          name: "Mozzarella di Bufala",
          price: 8.9,
          stock: 100,
        },
      }),
      prisma.products.upsert({
        where: { slug: "gorgonzola-piccante" },
        create: {
          workspaceId: workspace.id,
          name: "Gorgonzola Piccante",
          sku: "FORMAG-003",
          slug: "gorgonzola-piccante",
          description: "Formaggio a pasta blu, 200g",
          price: 9.5,
          stock: 40,
          region: "Lombardia, Italia",
          certifications: ["DOP"],
          isActive: true,
        },
        update: {
          name: "Gorgonzola Piccante",
          price: 9.5,
          stock: 40,
        },
      }),
      prisma.products.upsert({
        where: { slug: "ricotta-pecora" },
        create: {
          workspaceId: workspace.id,
          name: "Ricotta di Pecora",
          sku: "FORMAG-004",
          slug: "ricotta-pecora",
          description: "Ricotta fresca siciliana, 500g",
          price: 5.5,
          stock: 75,
          region: "Sicilia, Italia",
          isActive: true,
        },
        update: {
          name: "Ricotta di Pecora",
          price: 5.5,
          stock: 75,
        },
      }),
      prisma.products.upsert({
        where: { slug: "taleggio-dop" },
        create: {
          workspaceId: workspace.id,
          name: "Taleggio DOP",
          sku: "FORMAG-005",
          slug: "taleggio-dop",
          description: "Formaggio semigrasso a pasta molle, 200g",
          price: 11.0,
          stock: 35,
          region: "Lombardia, Italia",
          certifications: ["DOP"],
          isActive: true,
        },
        update: {
          name: "Taleggio DOP",
          price: 11.0,
          stock: 35,
        },
      }),
      prisma.products.upsert({
        where: { slug: "burrata" },
        create: {
          workspaceId: workspace.id,
          name: "Burrata",
          sku: "FORMAG-006",
          slug: "burrata",
          description: "Formaggio fresco con crema di burro, 150g",
          price: 7.5,
          stock: 60,
          region: "Puglia, Italia",
          isActive: true,
        },
        update: {
          name: "Burrata",
          price: 7.5,
          stock: 60,
        },
      }),
    ]);

    console.log("✅ Created", products.length, "test products");

    // Create or update sample order for repeat order test
    const order = await prisma.orders.upsert({
      where: { orderCode: "ORD-048-2025" },
      create: {
        workspaceId: workspace.id,
        customerId: customer.id,
        orderCode: "ORD-048-2025",
        status: "DELIVERED",
        totalAmount: 45.5,
        items: {
          create: [
            {
              productId: products[0].id,
              quantity: 2,
              unitPrice: 12.5,
              totalPrice: 25.0,
            },
            {
              productId: products[1].id,
              quantity: 1,
              unitPrice: 8.9,
              totalPrice: 8.9,
            },
          ],
        },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
      update: {
        status: "DELIVERED",
        totalAmount: 45.5,
      },
    });

    console.log("✅ Created sample order:", order.orderCode);

    // Create Agent Configs for the workspace
    // These will be loaded from templates at runtime, but we need to create the records
    const routerConfig = await prisma.agentConfig.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: "ROUTER" } },
      create: {
        workspaceId: workspace.id,
        name: "Router Agent",
        type: "ROUTER",
        description: "Central routing agent that delegates to specialized agents",
        icon: "Router",
        systemPrompt: "You are the Router Agent. Analyze customer intent and delegate to appropriate agents.",
        order: 0,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });

    const productSearchConfig = await prisma.agentConfig.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: "PRODUCT_SEARCH" } },
      create: {
        workspaceId: workspace.id,
        name: "Product Search Agent",
        type: "PRODUCT_SEARCH",
        description: "Searches products and presents them with intelligent grouping",
        icon: "Search",
        systemPrompt: "You are the Product Search Agent. Search for products and intelligently group results when there are more than 5 items.",
        order: 2,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });

    const cartConfig = await prisma.agentConfig.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: "CART_MANAGEMENT" } },
      create: {
        workspaceId: workspace.id,
        name: "Cart Management Agent",
        type: "CART_MANAGEMENT",
        description: "Manages shopping cart operations",
        icon: "ShoppingCart",
        systemPrompt: "You are the Cart Management Agent. Help customers manage their shopping cart.",
        order: 3,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });

    const orderTrackingConfig = await prisma.agentConfig.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: "ORDER_TRACKING" } },
      create: {
        workspaceId: workspace.id,
        name: "Order Tracking Agent",
        type: "ORDER_TRACKING",
        description: "Tracks orders and provides status updates",
        icon: "Package",
        systemPrompt: "You are the Order Tracking Agent. Help customers track their orders.",
        order: 4,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });

    const supportConfig = await prisma.agentConfig.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: "CUSTOMER_SUPPORT" } },
      create: {
        workspaceId: workspace.id,
        name: "Customer Support Agent",
        type: "CUSTOMER_SUPPORT",
        description: "Provides customer support and escalation",
        icon: "MessageCircle",
        systemPrompt: "You are the Customer Support Agent. Help customers with their inquiries.",
        order: 5,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });

    // 🆕 CONVERSATION HISTORY LAYER - Humanization layer
    const conversationHistoryConfig = await prisma.agentConfig.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: "CONVERSATION_HISTORY" } },
      create: {
        workspaceId: workspace.id,
        name: "Conversation History Layer",
        type: "CONVERSATION_HISTORY",
        description: "Humanizes responses with context, greetings, and offers",
        icon: "MessageCircle",
        systemPrompt: `# Conversation History Layer

Sei il layer finale di umanizzazione delle risposte per {{workspaceName}}.

## 🎭 IDENTITÀ
- **Nome bot**: {{botName}}
- **Personalità**: {{botIdentity}}

## 🎯 IL TUO RUOLO
Ricevi risposte TECNICHE dagli agent e le trasformi in risposte UMANE, naturali e contestuali.

## ⚡ REGOLE CHIAVE
1. SALUTO: Solo al primo messaggio o se cliente saluta
2. EMOJI: Sì per conferme/spedizioni, MAI nel carrello/prodotti/prezzi
3. VALORI: NON modificare MAI numeri, prezzi, nomi prodotti
4. COERENZA: Verifica che risposta sia pertinente alla domanda
5. MENU: Preserva menu numerici esattamente

## ❌ NON FARE MAI
- NON inventare prodotti o prezzi
- NON cambiare numeri
- NON aggiungere emoji nel carrello
- NON tradurre (c'è Translation Agent)

## 📤 OUTPUT
Solo il messaggio finale, senza prefissi.`,
        model: "openai/gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 500,
        order: 8,
        isActive: true,
      },
      update: {
        isActive: true,
        temperature: 0.7,
      },
    });

    // TRANSLATION AGENT
    const translationConfig = await prisma.agentConfig.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type: "TRANSLATION" } },
      create: {
        workspaceId: workspace.id,
        name: "Translation Agent",
        type: "TRANSLATION",
        description: "Translates responses to customer language",
        icon: "Globe",
        systemPrompt: "You are the Translation Agent. Translate the message to the target language while preserving formatting, numbers, and technical terms.",
        model: "openai/gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 1024,
        order: 7,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });

    console.log("✅ Created Agent Configs");

    console.log("\n✨ Seed completed successfully!");
    console.log("\n📋 Test Data:");
    console.log("   Workspace: BellItalia VIP");
    console.log("   Workspace ID:", workspace.id);
    console.log("   Customer: Mario Rossi (+390212345678)");
    console.log("   Products: 6 cheese products");
    console.log("   Sample Order: ORD-048-2025");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
