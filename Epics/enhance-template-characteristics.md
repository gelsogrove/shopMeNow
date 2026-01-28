# ✅ ENHANCE TEMPLATE: Aggiungi Caratteristiche al Template Attuale

**Strategia**: Mantieni tutto quello che c'è + aggiungi caratteristiche prodotti  
**Obiettivo**: Più informazioni per LLM senza perdere contesto esistente

---

## 🔧 SOLUZIONE: Estendi PromptVariableBuilder

### 📋 Template Attuale (da mantenere)
```typescript
// ATTUALE in PromptVariableBuilder.build()
const variables = {
  // ✅ MANTIENI TUTTO QUESTO
  customerName: customer?.name || 'Cliente',
  customerPhone: customer?.phone || '',
  customerEmail: customer?.email || '',
  companyName: workspace.name,
  botIdentityResponse: workspace.botIdentityResponse || '',
  products: this.buildProductsList(workspace.id), // ← Solo nome + prezzo
  categories: this.buildCategoriesList(workspace.id),
  faqs: this.buildFaqsList(workspace.id),
  // ... altre variabili esistenti
}
```

### ➕ AGGIUNGI: Nuove Variabili con Caratteristiche

```typescript
// services/prompt-variable-builder.service.ts (ENHANCED)
export class PromptVariableBuilder {
  
  static async build(customer, workspace, dynamicContent, context) {
    return {
      // ✅ MANTIENI tutte le variabili esistenti
      ...this.buildExistingVariables(customer, workspace, dynamicContent, context),
      
      // ➕ AGGIUNGI nuove variabili con caratteristiche
      productsWithDetails: await this.buildProductsWithCharacteristics(workspace.id),
      productsByCategory: await this.buildProductsByCategory(workspace.id),
      featuredProducts: await this.buildFeaturedProducts(workspace.id),
      productCharacteristics: await this.buildProductCharacteristics(workspace.id)
    }
  }

  // ➕ NUOVO: Prodotti con caratteristiche complete
  private static async buildProductsWithCharacteristics(workspaceId: string): Promise<string> {
    const products = await prisma.product.findMany({
      where: { workspaceId, isActive: true },
      include: { 
        characteristics: true,
        categories: { include: { category: true } }
      },
      take: 100,
      orderBy: { createdAt: 'desc' }
    })

    return products.map(product => {
      const characteristics = product.characteristics
        .map(c => `${c.name}: ${c.value}${c.unit ? ` ${c.unit}` : ''}`)
        .join(', ')
      
      const categories = product.categories
        .map(pc => pc.category.name)
        .join(', ')

      return `
📦 **${product.name}**
💰 Prezzo: €${product.price.toLocaleString()}
📂 Categoria: ${categories || 'Non categorizzato'}
📋 Caratteristiche: ${characteristics || 'Nessuna caratteristica'}
📝 Descrizione: ${product.description?.substring(0, 200) || 'Nessuna descrizione'}
🆔 ID: ${product.id}
`.trim()
    }).join('\n\n')
  }

  // ➕ NUOVO: Prodotti raggruppati per categoria
  private static async buildProductsByCategory(workspaceId: string): Promise<string> {
    const categories = await prisma.category.findMany({
      where: { workspaceId },
      include: {
        products: {
          include: { 
            product: { 
              include: { characteristics: true }
            }
          },
          take: 10 // Max 10 prodotti per categoria
        }
      }
    })

    return categories.map(category => {
      const products = category.products.map(pc => {
        const characteristics = pc.product.characteristics
          .slice(0, 3) // Max 3 caratteristiche per prodotto
          .map(c => `${c.name}:${c.value}${c.unit || ''}`)
          .join(' ')
        
        return `  • ${pc.product.name} - €${pc.product.price} ${characteristics ? `(${characteristics})` : ''}`
      }).join('\n')

      return `🏷️ **${category.name}**:\n${products}`
    }).join('\n\n')
  }

  // ➕ NUOVO: Prodotti in evidenza con dettagli
  private static async buildFeaturedProducts(workspaceId: string): Promise<string> {
    const products = await prisma.product.findMany({
      where: { 
        workspaceId, 
        isActive: true,
        // Logica per "featured": più recenti o più costosi
        OR: [
          { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // Ultimi 30 giorni
          { price: { gte: 1000 } } // Prodotti premium
        ]
      },
      include: { characteristics: true },
      take: 20,
      orderBy: { price: 'desc' }
    })

    return products.map(product => {
      const keyCharacteristics = product.characteristics
        .filter(c => ['superficie', 'taglia', 'peso', 'marca'].some(key => 
          c.name.toLowerCase().includes(key)
        ))
        .slice(0, 2)
        .map(c => `${c.value}${c.unit || ''}`)
        .join(' ')

      return `⭐ ${product.name} - €${product.price.toLocaleString()} ${keyCharacteristics ? `(${keyCharacteristics})` : ''}`
    }).join('\n')
  }

  // ➕ NUOVO: Mappa caratteristiche per ricerca rapida
  private static async buildProductCharacteristics(workspaceId: string): Promise<string> {
    const characteristics = await prisma.productCharacteristic.findMany({
      where: { 
        product: { workspaceId, isActive: true }
      },
      include: { product: true },
      orderBy: { name: 'asc' }
    })

    // Raggruppa per nome caratteristica
    const grouped = characteristics.reduce((acc, char) => {
      if (!acc[char.name]) acc[char.name] = []
      acc[char.name].push(`${char.product.name}:${char.value}${char.unit || ''}`)
      return acc
    }, {} as Record<string, string[]>)

    return Object.entries(grouped)
      .map(([name, values]) => `${name}: ${values.slice(0, 10).join(', ')}`) // Max 10 valori per caratteristica
      .join('\n')
  }
}
```

---

## 📝 NUOVE VARIABILI NEL TEMPLATE

### Template Prompt Aggiornato
```markdown
# Template Agent (es. product-search-agent.md)

Sei un esperto di ricerca prodotti per {{companyName}}.

## 📦 CATALOGO PRODOTTI COMPLETO
{{productsWithDetails}}

## 🏷️ PRODOTTI PER CATEGORIA  
{{productsByCategory}}

## ⭐ PRODOTTI IN EVIDENZA
{{featuredProducts}}

## 🔍 CARATTERISTICHE DISPONIBILI
{{productCharacteristics}}

## 📋 LISTA PRODOTTI SEMPLICE (per riferimento rapido)
{{products}}

## 📂 CATEGORIE
{{categories}}

---

Quando l'utente cerca "{{userMessage}}", usa tutte le informazioni sopra per dare una risposta completa e dettagliata.

Esempi di ricerca:
- "piso de 40mq" → Cerca in caratteristiche superficie
- "taglia M" → Cerca in caratteristiche taglia  
- "sotto 200 euro" → Filtra per prezzo
```

---

## 🎯 VANTAGGI APPROCCIO ADDITIVO

### ✅ Pro
- **Zero perdite**: Mantieni tutto il contesto esistente
- **Più informazioni**: LLM ha accesso completo a caratteristiche
- **Flessibilità**: Può usare lista semplice O dettagli completi
- **Backward compatible**: Template esistenti continuano a funzionare
- **Ricerca avanzata**: Può matchare caratteristiche specifiche

### ⚠️ Gestione Token
```typescript
// Token management intelligente
const MAX_TOKENS = {
  productsWithDetails: 8000,    // Prodotti completi
  productsByCategory: 4000,     // Raggruppati
  featuredProducts: 2000,       // In evidenza
  productCharacteristics: 3000, // Mappa caratteristiche
  products: 2000                // Lista semplice (fallback)
}

// Se supera limite, usa versioni ridotte
if (totalTokens > 15000) {
  // Usa solo featuredProducts + products + productCharacteristics
}
```

---

## 🔄 MIGRATION PLAN

### Step 1: Aggiungi Nuovi Metodi (1h)
```typescript
// Implementa buildProductsWithCharacteristics, buildProductsByCategory, etc.
```

### Step 2: Update Template Files (30min)
```bash
# Aggiungi nuove variabili ai prompt esistenti
{{productsWithDetails}}
{{productsByCategory}}
{{featuredProducts}}
{{productCharacteristics}}
```

### Step 3: Test & Optimize (1h)
```typescript
// Test con workspace reali, ottimizza token usage
```

### Step 4: Rollout Graduale (30min)
```typescript
// Feature flag per abilitare gradualmente
```

---

## 💡 ESEMPIO OUTPUT

### Prima (Solo Nome + Prezzo)
```
Prodotti:
• Appartamento Via Roma - €180.000
• Bilocale Centro - €195.000
```

### Dopo (Con Caratteristiche)
```
📦 **Appartamento Via Roma**
💰 Prezzo: €180.000
📂 Categoria: Immobili Residenziali
📋 Caratteristiche: superficie: 42 mq, locali: 2 n., piano: 3, zona: centro
📝 Descrizione: Luminoso appartamento in pieno centro storico, completamente ristrutturato
🆔 ID: prod_123

📦 **Bilocale Centro**
💰 Prezzo: €195.000
📂 Categoria: Immobili Residenziali  
📋 Caratteristiche: superficie: 38 mq, locali: 2 n., piano: 1, balcone: si
📝 Descrizione: Elegante bilocale con balcone vista piazza
🆔 ID: prod_124

🏷️ **Immobili Residenziali**:
  • Appartamento Via Roma - €180.000 (42mq 2loc centro)
  • Bilocale Centro - €195.000 (38mq 2loc balcone)

⭐ Prodotti in Evidenza:
⭐ Appartamento Via Roma - €180.000 (42mq centro)
⭐ Bilocale Centro - €195.000 (38mq balcone)

🔍 Caratteristiche Disponibili:
superficie: Appartamento Via Roma:42mq, Bilocale Centro:38mq
locali: Appartamento Via Roma:2n., Bilocale Centro:2n.
piano: Appartamento Via Roma:3, Bilocale Centro:1
```

**🎯 Risultato**: LLM ha contesto completo per rispondere a "dammi un piso de 40mq" con dettagli specifici!

**⚡ Effort**: 3h totali per implementazione completa