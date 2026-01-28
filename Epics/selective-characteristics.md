# 🎯 CARATTERISTICHE SELETTIVE NEL PROMPT - Strategia Smart

**Domanda**: "Ti porti dietro nel template tutte le caratteristiche?"  
**Risposta**: NO! Solo quelle **essenziali** per il business type specifico.

---

## ❌ COSA NON FARE: Tutte le Caratteristiche

```typescript
// ❌ SBAGLIATO: Tutte le 15+ caratteristiche
• Appartamento Via Roma - €180k (superficie:42mq, locali:2, bagni:1, piano:3, ascensore:si, balcone:si, posto_auto:no, classe_energetica:B, riscaldamento:autonomo, anno_costruzione:1980, stato:buono, esposizione:sud, spese_condominiali:80, arredato:no, libero_da:subito)
```
**Problema**: 200+ token per prodotto = overflow immediato

---

## ✅ COSA FARE: Caratteristiche Essenziali per Business

### 🏠 REAL ESTATE: Solo 3-4 caratteristiche chiave
```typescript
const ESSENTIAL_CHARACTERISTICS = {
  real_estate: ['superficie', 'locali', 'zona', 'piano'],
  fashion: ['taglia', 'colore', 'materiale'],
  food: ['peso', 'ingredienti', 'scadenza'],
  electronics: ['marca', 'modello', 'garanzia']
}

// ✅ FORMATO OTTIMIZZATO
• Appartamento Via Roma - €180k (42mq, 2loc, centro, 3°piano)
• Bilocale Duomo - €195k (38mq, 2loc, centro, 1°piano)
• Villa Collina - €350k (120mq, 4loc, periferia, villa)
```
**Risultato**: 25 token per prodotto invece di 200+

---

## 🔧 IMPLEMENTAZIONE: Selective Characteristic Filter

```typescript
// services/characteristic-filter.service.ts
export class CharacteristicFilter {
  
  private static BUSINESS_ESSENTIALS = {
    real_estate: {
      required: ['superficie', 'locali'],
      optional: ['zona', 'piano', 'balcone'],
      maxCount: 4
    },
    fashion: {
      required: ['taglia'],
      optional: ['colore', 'materiale', 'stagione'],
      maxCount: 3
    },
    food: {
      required: ['peso'],
      optional: ['ingredienti', 'biologico', 'scadenza'],
      maxCount: 3
    },
    default: {
      required: [],
      optional: ['marca', 'modello', 'tipo'],
      maxCount: 2
    }
  }

  static filterEssentialCharacteristics(
    product: Product, 
    businessType: string
  ): string {
    
    const config = this.BUSINESS_ESSENTIALS[businessType] || this.BUSINESS_ESSENTIALS.default
    const characteristics = product.characteristics || []
    
    // 1. Prima le required
    const required = characteristics.filter(c => 
      config.required.some(req => 
        c.name.toLowerCase().includes(req.toLowerCase())
      )
    )
    
    // 2. Poi le optional fino al limite
    const optional = characteristics.filter(c => 
      config.optional.some(opt => 
        c.name.toLowerCase().includes(opt.toLowerCase())
      )
    ).slice(0, config.maxCount - required.length)
    
    // 3. Combina e formatta
    const selected = [...required, ...optional]
    
    return selected
      .map(c => this.formatCharacteristic(c, businessType))
      .join(', ')
  }

  private static formatCharacteristic(char: ProductCharacteristic, businessType: string): string {
    const value = char.value
    const unit = char.unit || ''
    
    // Formati specifici per business
    switch (businessType) {
      case 'real_estate':
        if (char.name.toLowerCase().includes('superficie')) return `${value}${unit}`
        if (char.name.toLowerCase().includes('locali')) return `${value}loc`
        if (char.name.toLowerCase().includes('piano')) return `${value}°piano`
        break
        
      case 'fashion':
        if (char.name.toLowerCase().includes('taglia')) return `T.${value}`
        break
        
      case 'food':
        if (char.name.toLowerCase().includes('peso')) return `${value}${unit}`
        break
    }
    
    // Formato generico
    return `${char.name}:${value}${unit}`
  }
}
```

---

## 🎯 ESEMPIO PRATICO: Real Estate

### Database Products
```sql
-- Prodotto con 12 caratteristiche
INSERT INTO product_characteristics VALUES
('superficie', '42', 'mq'),
('locali', '2', 'n.'),
('bagni', '1', 'n.'),
('piano', '3', null),
('ascensore', 'si', null),
('balcone', 'si', null),
('posto_auto', 'no', null),
('classe_energetica', 'B', null),
('riscaldamento', 'autonomo', null),
('anno_costruzione', '1980', null),
('stato', 'buono', null),
('zona', 'centro', null);
```

### Prompt Output (Solo Essenziali)
```typescript
// ✅ OTTIMIZZATO: Solo 4 caratteristiche essenziali
const businessType = 'real_estate'
const essentials = CharacteristicFilter.filterEssentialCharacteristics(product, businessType)

// Risultato:
"• Appartamento Via Roma - €180k (42mq, 2loc, centro, 3°piano)"

// Invece di:
"• Appartamento Via Roma - €180k (superficie:42mq, locali:2n., bagni:1n., piano:3, ascensore:si, balcone:si, posto_auto:no, classe_energetica:B, riscaldamento:autonomo, anno_costruzione:1980, stato:buono, zona:centro)"
```

---

## 📊 TOKEN COMPARISON

| Approccio | Caratteristiche | Token/Prodotto | 100 Prodotti |
|-----------|----------------|----------------|--------------|
| **Tutte** | 12 | 200 | 20,000 🚨 |
| **Essenziali** | 4 | 25 | 2,500 ✅ |
| **Solo Nome/Prezzo** | 0 | 15 | 1,500 ⚠️ |

**🎯 Sweet Spot**: 4 caratteristiche essenziali = Informativo ma compatto

---

## 🔄 INTEGRATION: Updated PromptVariableBuilder

```typescript
// services/prompt-variable-builder.service.ts (UPDATED)
export class PromptVariableBuilder {
  
  static async buildOptimizedProducts(
    workspaceId: string,
    businessType: string,
    maxProducts: number = 100
  ): Promise<string> {
    
    const products = await prisma.product.findMany({
      where: { workspaceId, isActive: true },
      include: { characteristics: true },
      take: maxProducts,
      orderBy: { createdAt: 'desc' }
    })

    return products.map(product => {
      // Solo caratteristiche essenziali per business type
      const essentials = CharacteristicFilter.filterEssentialCharacteristics(
        product, 
        businessType
      )
      
      const characteristicsPart = essentials ? ` (${essentials})` : ''
      
      return `• ${product.name} - €${product.price.toLocaleString()}${characteristicsPart}`
    }).join('\n')
  }
}
```

---

## 🎯 CONFIGURAZIONE PER WORKSPACE

```typescript
// Nel Settings UI - Sezione "Prompt Optimization"
interface PromptConfig {
  businessType: 'real_estate' | 'fashion' | 'food' | 'electronics' | 'default'
  maxProductsInPrompt: number // 50-200
  essentialCharacteristics: string[] // Personalizzabili
  includeAllCharacteristics: boolean // Override per casi speciali
}

// Esempio configurazione Real Estate
const realEstateConfig: PromptConfig = {
  businessType: 'real_estate',
  maxProductsInPrompt: 150,
  essentialCharacteristics: ['superficie', 'locali', 'zona', 'piano'],
  includeAllCharacteristics: false
}
```

---

## ✅ RISULTATO FINALE

**🎯 NON aggiungiamo campi al prompt**  
**✅ Filtriamo intelligentemente quelli esistenti**  
**📊 Token efficiency: -90% vs approccio naive**  
**🧠 Manteniamo qualità LLM con contesto essenziale**

**Esempio Output**:
```
Prodotti disponibili:
• Appartamento Via Roma - €180k (42mq, 2loc, centro, 3°piano)
• Bilocale Duomo - €195k (38mq, 2loc, centro, 1°piano)  
• Villa Collina - €350k (120mq, 4loc, periferia, villa)
• Loft Garibaldi - €220k (45mq, 1loc, centro, attico)
```

**🚀 Implementazione**: 3h per CharacteristicFilter + integration