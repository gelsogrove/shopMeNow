import { prisma } from "@echatbot/database";

async function seed() {
  console.log("🌱 Seeding test data...");

  try {
    // Find or create workspace by slug (unique constraint)
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
