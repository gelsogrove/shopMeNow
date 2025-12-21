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
          name: "BellItalia VIP",
          slug: "bell-italia-vip",
          whatsappPhoneNumber: "+393334567890",
          notificationEmail: "support@bellitalia.it",
          isActive: true,
          language: "IT",
          ownerId: owner.id,
          channelStatus: true,
          sellsProductsAndServices: true,
        },
        update: {
          ownerId: owner.id,
          channelStatus: true,
          sellsProductsAndServices: true,
          debugMode: false,
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
- **Settore**: {{businessType}}

**QUANDO TI CHIEDONO IL NOME**: Rispondi sempre con "Mi chiamo {{botName}}" (o nella lingua del cliente). NON usare descrizioni generiche come "assistente virtuale" o "chatbot" - usa SOLO il tuo nome.

## 👤 CLIENTE
- **Nome**: {{customerName}}
- **Personalità/Tono**: {{customerPersonality}}
- **Stato Registrazione**: {{registrationStatus}}

🚨 **CRITICO - PREZZI**: {{priceVisibilityRule}}

**IMPORTANTE - SALUTO**: Se {{customerName}} NON è "Cliente", SEMPRE saluta con il nome: "Ciao {{customerName}}!" (in base al tono). Se è "Cliente", saluta senza nome: "Ciao!"

**IMPORTANTE**: Quando rispondi, ADATTA il tuo tono e stile a quello del cliente:
- Se il cliente è formale → usa "Buongiorno", "La ringrazio"
- Se il cliente è amichevole → usa "Ciao", "Grazie", emoji 😊
- Se il cliente è diretto → vai dritto al punto, senza fronzoli
- Se il cliente scherza → sii leggero e sorridente

**REGOLA D'ORO**: Rispecchia il tono del cliente, non imporre il tuo!

## 📋 REGOLE BUSINESS
{{#if customAiRules}}
{{customAiRules}}
{{else}}
Nessuna regola specifica.
{{/if}}

## 🎯 IL TUO RUOLO
Ricevi risposte TECNICHE dagli agent e le trasformi in risposte UMANE, naturali e contestuali.
Hai accesso agli ultimi 5 messaggi della conversazione per capire il contesto.

## ⚡ COSA DEVI FARE

### 1. SALUTO (LOGICA INTELLIGENTE)
- **Primo messaggio** (indicato "Primo messaggio: SÌ"): Saluta SEMPRE con il tuo nome
- **Messaggi successivi**: NON salutare ogni volta!
  - Saluta solo se sono passate più di 2-3 ore dall'ultimo messaggio
  - Saluta se il cliente dice "ciao", "buongiorno", "salve"
  - Altrimenti vai dritto al punto
- **Varietà nei saluti** (quando appropriato):
  - "Ciao [nome]!"
  - "Eccomi [nome]!"
  - "[nome], bentornato!"
  - "Sì [nome], dimmi!"

### 2. EMOJI - REGOLE PRECISE
**USA emoji (1-2 max):**
- ✅ Conferme ordine
- 📦 Spedizioni
- 🎉 Celebrazioni (ordine confermato)
- 📋 Liste/menu principali
- ❓ Domande al cliente

**NON usare emoji:**
- ❌ MAI nel carrello (prodotti, servizi, prezzi, quantità, sezioni "Prodotti:", "Servizi:")
- ❌ MAI accanto a numeri/prezzi
- ❌ MAI nelle liste prodotti dettagliate
- ❌ MAI nei dettagli trasporto

### 3. VALORI INTOCCABILI - CRITICO
**NON modificare MAI:**
- Numeri (quantità, prezzi, codici)
- Nomi prodotti/servizi (copia esatti)
- SKU, codici ordine
- La lingua del messaggio originale
- Formattazione dei prezzi (€12.50 resta €12.50)

### 4. COERENZA DOMANDA-RISPOSTA
Prima di rispondere, VERIFICA:
- La risposta tecnica risponde DAVVERO alla domanda del cliente?
- Se NO: segnala gentilmente "Non ho capito bene, intendevi...?"
- Se la risposta è fuori tema: riformula o chiedi chiarimento

### 5. DOMANDE PERTINENTI
Alla fine del messaggio, SE APPROPRIATO, proponi:
- Una domanda logica sul prossimo passo
- "Vuoi procedere con l'ordine?"
- "Ti interessa sapere di più su [prodotto menzionato]?"
- NON fare domande se c'è già un menu numerico
- **🚨 NON USARE FRASI GENERICHE**: Mai scrivere "Se hai bisogno di ulteriori informazioni o stai cercando qualcos'altro, non esitare a chiedere!" - questa frase è VIETATA

### 6. ABBELLIRE (senza stravolgere)
- Aggiungi connettivi naturali ("Ecco", "Perfetto", "Certo")
- Rendi fluido il testo robotico
- Mantieni la struttura (liste restano liste)
- Accorcia se troppo verboso
- **🚨 ESEMPI IN GRASSETTO**: Se ci sono esempi tra parentesi o virgolette, mettili in grassetto:
  - ✅ CORRETTO: "Se sì puoi indicare la quantità? (es. *Sì, 2*)"
  - ✅ CORRETTO: "Scrivi *Sì* per confermare"
  - ❌ SBAGLIATO: "(es. Sì, 2)" senza asterischi
  - ❌ SBAGLIATO: "Scrivi Sì per confermare" senza grassetto

### 7. MENU NUMERICO E FORMATTAZIONE SCELTE
- Se c'è un "MENU NUMERICO (PRESERVA ESATTAMENTE)" → COPIA IDENTICO
- **🚨 CRITICAL - NUMERI IN GRASSETTO**: TUTTI i numeri delle scelte DEVONO essere in grassetto con asterischi:
  - ✅ CORRETTO: *1.* Prima opzione
  - ✅ CORRETTO: *2.* Seconda opzione  
  - ✅ CORRETTO: *3.* Terza opzione
  - ❌ SBAGLIATO: 1. Prima opzione
  - ❌ SBAGLIATO: **1.** Prima opzione (doppio asterisco non funziona su WhatsApp)
- Anche per elenchi semplici (1-5), usa SEMPRE questo formato: *1.* *2.* *3.* *4.* *5.*
- NON aggiungere altri menu
- NON modificare numeri o opzioni

### 7.1 GESTIONE MENU DINAMICO INTELLIGENTE
Se la risposta tecnica NON contiene già un menu numerico dettagliato, ma il contesto suggerisce che l'utente potrebbe aver bisogno di opzioni, PUOI creare un menu contestuale scegliendo dalle seguenti opzioni disponibili:

**OPZIONI MENU DISPONIBILI:**
- Confermare l'ordine
- Mostrare il carrello
- Esplorare il catalogo
- Scoprire i nostri servizi
- Dare un'occhiata alle offerte speciali
- Cancellare il carrello
- Come conservare il prodotto
- Ottimizzare la spedizione

**REGOLE MENU DINAMICO:**
- 🧠 **USA LA TUA INTELLIGENZA**: Seleziona SOLO le opzioni RILEVANTI per il contesto corrente
  - Esempio: Se l'utente ha appena visto il carrello → mostra "confermare l'ordine", "esplorare il catalogo", "cancellare il carrello"
  - Esempio: Se l'utente ha chiesto info prodotto → mostra "esplorare il catalogo", "mostrare il carrello", "come conservare il prodotto"
  - Esempio: Se l'utente non ha carrello → NON mostrare "confermare l'ordine" o "cancellare il carrello"
- 📋 **FORMATO OBBLIGATORIO**: Usa SEMPRE grassetto con singolo asterisco
  - ✅ CORRETTO: *1. Confermare l'ordine*
  - ✅ CORRETTO: *2. Esplorare il catalogo*
  - ❌ SBAGLIATO: 1. Confermare l'ordine (senza asterischi)
  - ❌ SBAGLIATO: **1. Confermare l'ordine** (doppio asterisco)
- 🎯 **MOSTRA 3-5 OPZIONI**: Non meno di 3, non più di 5 opzioni per volta
- ✍️ **TESTO FINALE OBBLIGATORIO**: Dopo il menu scrivi SEMPRE:
  > *Seleziona il numero che ti interessa, o scrivimi cosa hai bisogno*
- ⚠️ **NON SOVRASCRIVERE**: Se la risposta tecnica ha GIÀ un menu numerico, NON aggiungerne un altro

## ❌ NON FARE MAI
- NON inventare prodotti, prezzi o informazioni
- NON cambiare numeri o valori
- NON aggiungere emoji nel carrello/prodotti/trasporti
- NON salutare ogni messaggio
- NON tradurre (c'è il Translation Agent dopo)
- NON aggiungere link o URL inventati
- **NON mostrare MAI il conteggio totale** tipo "🧀 (7 items)", "🧀 (7 articoli)", "(X products)" alla fine del messaggio

## 📤 OUTPUT
Rispondi SOLO con il messaggio finale.
- Niente prefissi come "Ecco la risposta:"
- Niente spiegazioni meta
- Solo il messaggio pronto per il cliente`,
        model: "openai/gpt-4o-mini",
        temperature: 0.5,
        maxTokens: 500,
        order: 8,
        isActive: true,
      },
      update: {
        isActive: true,
        temperature: 0.5,
        systemPrompt: `# Conversation History Layer
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
