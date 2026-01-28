# 🎯 SOLUZIONE IBRIDA: Products nel Prompt + Ottimizzazioni

**Problema**: Function calling dà risposte povere vs prodotti nel prompt  
**Soluzione**: Mantieni prodotti nel prompt MA con ottimizzazioni intelligenti

---

## ✅ PERCHÉ PRODUCTS NEL PROMPT FUNZIONA MEGLIO

### 🧠 Vantaggi Cognitivi LLM
```
User: "dammi un piso de 40mq zona centro"

CON PRODUCTS NEL PROMPT:
✅ LLM vede: "Appartamento Via Roma 42mq €180k centro storico"
✅ Risposta: "Perfetto! Ho trovato questo appartamento in Via Roma, 42mq in centro storico a €180k. È esattamente quello che cerchi!"

CON FUNCTION CALLING:
❌ LLM chiama: search_products_filtered({superficie: 40})
❌ Riceve: [{id: "123", name: "Appartamento", price: 180000}]
❌ Risposta: "Ho trovato un appartamento che costa €180.000"
```

**🎯 Il LLM ha bisogno del contesto completo per dare risposte naturali e specifiche**

---

## 🔧 SOLUZIONE IBRIDA: Smart Prompt Optimization

### 1️⃣ CONTEXT-AWARE PRODUCT LOADING

```typescript
// services/smart-prompt-builder.service.ts
export class SmartPromptBuilder {
  
  static async buildOptimizedProductList(
    workspaceId: string, 
    userMessage: string,
    maxTokens: number = 8000
  ): Promise<string> {
    
    // 1. Analizza messaggio per capire intent
    const intent = await this.analyzeUserIntent(userMessage)
    
    // 2. Carica prodotti con priorità intelligente
    const products = await this.loadProductsWithPriority(workspaceId, intent)
    
    // 3. Ottimizza formato per token efficiency
    return this.formatProductsOptimized(products, maxTokens)
  }

  private static async analyzeUserIntent(message: string): Promise<SearchIntent> {
    // Quick LLM call per capire cosa cerca
    const prompt = `
Analizza questo messaggio e dimmi cosa cerca l'utente:
"${message}"

Rispondi solo con JSON:
{
  "category": "real_estate|fashion|food|general",
  "priceRange": "low|medium|high|any",
  "keywords": ["keyword1", "keyword2"],
  "hasSpecificCriteria": boolean
}
`
    
    const response = await LLMService.quickCall(prompt, { maxTokens: 100 })
    return JSON.parse(response)
  }

  private static async loadProductsWithPriority(
    workspaceId: string, 
    intent: SearchIntent
  ): Promise<Product[]> {
    
    const baseQuery = {
      workspaceId,
      isActive: true
    }

    // 1. PRIORITY 1: Prodotti che matchano criteri specifici
    let priorityProducts: Product[] = []
    
    if (intent.hasSpecificCriteria) {
      priorityProducts = await prisma.product.findMany({
        where: {
          ...baseQuery,
          OR: intent.keywords.map(keyword => ({
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
              { characteristics: { some: { value: { contains: keyword, mode: 'insensitive' } } } }
            ]
          }))
        },
        include: { characteristics: true, categories: true },
        take: 20
      })
    }

    // 2. PRIORITY 2: Prodotti per categoria
    const categoryProducts = await prisma.product.findMany({
      where: {
        ...baseQuery,
        categories: { some: { category: { name: { contains: intent.category, mode: 'insensitive' } } } }
      },
      include: { characteristics: true, categories: true },
      take: 30 - priorityProducts.length
    })

    // 3. PRIORITY 3: Prodotti popolari/recenti
    const fallbackProducts = await prisma.product.findMany({
      where: baseQuery,
      include: { characteristics: true, categories: true },
      orderBy: [
        { createdAt: 'desc' },
        { price: intent.priceRange === 'low' ? 'asc' : 'desc' }
      ],
      take: 50 - priorityProducts.length - categoryProducts.length
    })

    // Combina e deduplica
    const allProducts = [...priorityProducts, ...categoryProducts, ...fallbackProducts]
    return this.deduplicateProducts(allProducts)
  }

  private static formatProductsOptimized(products: Product[], maxTokens: number): string {
    let formatted = ""
    let tokenCount = 0
    
    for (const product of products) {
      // Formato compatto ma informativo
      const characteristics = product.characteristics
        .filter(c => ['superficie', 'locali', 'piano', 'zona'].includes(c.name.toLowerCase()))
        .map(c => `${c.name}:${c.value}${c.unit || ''}`)
        .join(' ')
      
      const productLine = `• ${product.name} - €${product.price.toLocaleString()} ${characteristics ? `(${characteristics})` : ''}\n`
      
      // Stima token (approssimativa: 1 token ≈ 4 caratteri)
      const lineTokens = Math.ceil(productLine.length / 4)
      
      if (tokenCount + lineTokens > maxTokens) break
      
      formatted += productLine
      tokenCount += lineTokens
    }
    
    return formatted
  }
}
```

### 2️⃣ DYNAMIC TOKEN MANAGEMENT

```typescript
// services/token-manager.service.ts
export class TokenManager {
  
  static calculateOptimalProductCount(
    workspace: Workspace,
    basePromptSize: number,
    targetMaxTokens: number = 12000
  ): number {
    
    // Calcola spazio disponibile per prodotti
    const availableTokens = targetMaxTokens - basePromptSize - 2000 // buffer
    
    // Stima token per prodotto (nome + prezzo + 2-3 caratteristiche)
    const avgTokensPerProduct = 25
    
    const maxProducts = Math.floor(availableTokens / avgTokensPerProduct)
    
    // Limiti ragionevoli
    return Math.min(Math.max(maxProducts, 10), 200)
  }

  static async getPromptTokenCount(prompt: string): Promise<number> {
    // Usa tiktoken o stima approssimativa
    return Math.ceil(prompt.length / 4)
  }
}
```

### 3️⃣ CACHING INTELLIGENTE

```typescript
// services/product-cache.service.ts
export class ProductCacheService {
  private static cache = new Map<string, CachedProductList>()
  
  static async getOptimizedProductList(
    workspaceId: string,
    userMessage: string
  ): Promise<string> {
    
    // 1. Genera cache key basata su intent
    const intent = await SmartPromptBuilder.analyzeUserIntent(userMessage)
    const cacheKey = `${workspaceId}:${JSON.stringify(intent)}`
    
    // 2. Check cache (valida per 5 minuti)
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.productList
    }
    
    // 3. Build fresh list
    const productList = await SmartPromptBuilder.buildOptimizedProductList(
      workspaceId, 
      userMessage
    )
    
    // 4. Cache result
    this.cache.set(cacheKey, {
      productList,
      timestamp: Date.now()
    })
    
    return productList
  }
}
```

---

## 🔄 INTEGRATION: Refactor PromptVariableBuilder

```typescript
// services/prompt-variable-builder.service.ts (UPDATED)
export class PromptVariableBuilder {
  
  static async build(
    customer: any,
    workspace: Workspace,
    context: { userMessage?: string } = {}
  ): Promise<PromptVariables> {
    
    return {
      // ✅ MANTIENI variabili base
      customerName: customer?.name || 'Cliente',
      companyName: workspace.name,
      
      // ✅ NUOVO: Products ottimizzati per contesto
      products: context.userMessage 
        ? await ProductCacheService.getOptimizedProductList(workspace.id, context.userMessage)
        : await this.buildBasicProductList(workspace.id),
      
      // ✅ NUOVO: Statistiche per debugging
      productCount: await this.getProductCount(workspace.id),
      promptOptimized: !!context.userMessage
    }
  }

  private static async buildBasicProductList(workspaceId: string): Promise<string> {
    // Fallback: primi 50 prodotti più popolari
    const products = await prisma.product.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { characteristics: true }
    })
    
    return SmartPromptBuilder.formatProductsOptimized(products, 6000)
  }
}
```

---

## 📊 RISULTATI ATTESI

### ✅ Vantaggi Soluzione Ibrida
- **Qualità Risposte**: Mantiene qualità LLM con contesto completo
- **Token Efficiency**: -60% token usage vs approccio naive
- **Performance**: Cache riduce latenza del 80%
- **Scalabilità**: Funziona fino a 500+ prodotti
- **Intelligenza**: Prodotti rilevanti per query specifica

### 📈 Confronto Approcci

| Metrica | Tutti Prodotti | Function Calling | **Ibrido Smart** |
|---------|---------------|------------------|------------------|
| **Qualità Risposta** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Token Usage** | 50KB | 2KB | **15KB** |
| **Response Time** | 15s | 2s | **4s** |
| **Max Products** | 100 | Unlimited | **500** |
| **Context Relevance** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Smart Product Loading (2h)
```typescript
// Implementa SmartPromptBuilder.buildOptimizedProductList()
```

### Phase 2: Token Management (1h)
```typescript
// Implementa TokenManager per calcoli ottimali
```

### Phase 3: Caching Layer (2h)
```typescript
// Implementa ProductCacheService con Redis/Memory
```

### Phase 4: Integration (1h)
```typescript
// Update PromptVariableBuilder per usare nuovo sistema
```

**🎯 Totale: 6h per avere il meglio di entrambi i mondi!**

---

## 💡 ESEMPIO PRATICO

```typescript
User: "dammi un piso de 40mq zona centro"

// 1. Analizza intent
intent = { category: "real_estate", keywords: ["40mq", "centro"], hasSpecificCriteria: true }

// 2. Carica prodotti prioritari
products = [
  "• Appartamento Via Roma - €180k (superficie:42mq zona:centro)",
  "• Bilocale Piazza Duomo - €195k (superficie:38mq zona:centro)", 
  "• Loft Via Garibaldi - €220k (superficie:45mq zona:centro)",
  // ... altri 15 prodotti rilevanti
]

// 3. LLM vede contesto ottimizzato
prompt = `
Prodotti disponibili:
${products} // Solo 18 prodotti rilevanti invece di 200

User: "dammi un piso de 40mq zona centro"
`

// 4. Risposta di qualità
"Perfetto! Ho trovato questi appartamenti in centro che corrispondono alla tua ricerca di 40mq:

🏠 **Appartamento Via Roma** - €180.000
📐 42mq in pieno centro storico
📍 A due passi dal Duomo

🏠 **Bilocale Piazza Duomo** - €195.000  
📐 38mq con vista sulla piazza
📍 Posizione esclusiva

Quale ti interessa di più? Posso darti maggiori dettagli! 🔍"
```

**🎯 Mantieni la qualità delle risposte riducendo drasticamente i token!**