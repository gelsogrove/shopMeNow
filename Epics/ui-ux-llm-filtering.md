# 🎨 UI/UX DESIGN & LLM FILTERING - eChatbot

**Focus**: Form dinamiche + Filtraggio intelligente LLM per richieste specifiche

---

## 🔧 DYNAMIC FORMS - UI/UX Design

### 📋 Product Characteristics Form

```typescript
// ProductCharacteristicsForm.tsx
interface Characteristic {
  id: string
  name: string
  value: string
  type: 'text' | 'number' | 'select' | 'boolean'
  options?: string[]
}

const ProductCharacteristicsForm = () => {
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([])
  
  const addCharacteristic = () => {
    setCharacteristics([...characteristics, {
      id: crypto.randomUUID(),
      name: '',
      value: '',
      type: 'text'
    }])
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Caratteristiche Prodotto</h3>
        <Button 
          onClick={addCharacteristic}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Aggiungi Caratteristica
        </Button>
      </div>

      <div className="space-y-3">
        {characteristics.map((char, index) => (
          <CharacteristicRow 
            key={char.id}
            characteristic={char}
            onUpdate={(updated) => updateCharacteristic(index, updated)}
            onRemove={() => removeCharacteristic(index)}
          />
        ))}
      </div>

      {characteristics.length === 0 && (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Nessuna caratteristica aggiunta</p>
          <p className="text-sm">Clicca "Aggiungi Caratteristica" per iniziare</p>
        </div>
      )}
    </div>
  )
}

const CharacteristicRow = ({ characteristic, onUpdate, onRemove }) => (
  <div className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg border">
    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Nome caratteristica */}
      <Input
        placeholder="Nome (es. Superficie)"
        value={characteristic.name}
        onChange={(e) => onUpdate({...characteristic, name: e.target.value})}
        className="font-medium"
      />
      
      {/* Tipo */}
      <Select 
        value={characteristic.type}
        onValueChange={(type) => onUpdate({...characteristic, type})}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Testo</SelectItem>
          <SelectItem value="number">Numero</SelectItem>
          <SelectItem value="select">Selezione</SelectItem>
          <SelectItem value="boolean">Sì/No</SelectItem>
        </SelectContent>
      </Select>

      {/* Valore */}
      {characteristic.type === 'number' ? (
        <div className="flex gap-1">
          <Input
            type="number"
            placeholder="Valore"
            value={characteristic.value}
            onChange={(e) => onUpdate({...characteristic, value: e.target.value})}
          />
          <Input
            placeholder="Unità"
            className="w-20"
            value={characteristic.unit || ''}
            onChange={(e) => onUpdate({...characteristic, unit: e.target.value})}
          />
        </div>
      ) : (
        <Input
          placeholder="Valore"
          value={characteristic.value}
          onChange={(e) => onUpdate({...characteristic, value: e.target.value})}
        />
      )}
    </div>

    <Button
      variant="ghost"
      size="sm"
      onClick={onRemove}
      className="text-red-500 hover:text-red-700 hover:bg-red-50"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  </div>
)
```

### 🎯 Preset Templates per Business Type

```typescript
// CharacteristicPresets.ts
const BUSINESS_PRESETS = {
  real_estate: [
    { name: 'Superficie', type: 'number', unit: 'mq' },
    { name: 'Locali', type: 'number', unit: 'n.' },
    { name: 'Bagni', type: 'number', unit: 'n.' },
    { name: 'Piano', type: 'text' },
    { name: 'Ascensore', type: 'boolean' },
    { name: 'Balcone', type: 'boolean' },
    { name: 'Posto Auto', type: 'boolean' },
    { name: 'Classe Energetica', type: 'select', options: ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] }
  ],
  
  fashion: [
    { name: 'Taglia', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Colore', type: 'text' },
    { name: 'Materiale', type: 'text' },
    { name: 'Stagione', type: 'select', options: ['Primavera/Estate', 'Autunno/Inverno'] }
  ],
  
  food: [
    { name: 'Ingredienti', type: 'text' },
    { name: 'Allergeni', type: 'text' },
    { name: 'Peso', type: 'number', unit: 'g' },
    { name: 'Scadenza', type: 'text' },
    { name: 'Biologico', type: 'boolean' }
  ]
}

// Preset Selector Component
const PresetSelector = ({ businessType, onApplyPreset }) => (
  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium text-blue-900">Template Rapido</h4>
        <p className="text-sm text-blue-700">
          Applica caratteristiche comuni per {businessType}
        </p>
      </div>
      <Button 
        onClick={() => onApplyPreset(BUSINESS_PRESETS[businessType])}
        className="bg-blue-600 hover:bg-blue-700"
      >
        <Zap className="w-4 h-4 mr-2" />
        Applica Template
      </Button>
    </div>
  </div>
)
```

---

## 🤖 LLM FILTERING SYSTEM - Richieste Specifiche

### 🎯 Il Problema: "Dammi un piso de 40mq"

**Scenario**: Cliente cerca appartamento specifico con caratteristiche precise
**Challenge**: LLM deve filtrare prodotti per caratteristiche custom

### 🔍 Soluzione: Smart Filtering Engine

```typescript
// services/smart-filter.service.ts
export class SmartFilterService {
  
  /**
   * Estrae criteri di ricerca dal messaggio utente
   */
  static async extractSearchCriteria(message: string, workspace: Workspace): Promise<SearchCriteria> {
    const prompt = `
Analizza questo messaggio e estrai i criteri di ricerca per prodotti immobiliari:

Messaggio: "${message}"

Estrai SOLO i criteri specifici menzionati:
- superficie (in mq)
- numero locali
- prezzo (range)
- zona/località
- caratteristiche (ascensore, balcone, etc.)

Rispondi in JSON:
{
  "superficie": { "min": number, "max": number },
  "locali": number,
  "prezzo": { "min": number, "max": number },
  "zona": "string",
  "caratteristiche": ["string"],
  "confidence": 0.8
}
`

    const response = await LLMService.call({
      prompt,
      model: 'gpt-4-mini',
      temperature: 0.1,
      maxTokens: 300
    })

    return JSON.parse(response.content)
  }

  /**
   * Filtra prodotti basandosi sui criteri estratti
   */
  static async filterProducts(criteria: SearchCriteria, workspaceId: string): Promise<Product[]> {
    const whereConditions: any = {
      workspaceId,
      isActive: true
    }

    // Filtro per prezzo
    if (criteria.prezzo) {
      whereConditions.price = {
        gte: criteria.prezzo.min || 0,
        lte: criteria.prezzo.max || 999999999
      }
    }

    // Filtro per caratteristiche custom
    const characteristicFilters = []
    
    if (criteria.superficie) {
      characteristicFilters.push({
        characteristics: {
          some: {
            name: { contains: 'superficie', mode: 'insensitive' },
            value: {
              gte: criteria.superficie.min?.toString(),
              lte: criteria.superficie.max?.toString()
            }
          }
        }
      })
    }

    if (criteria.locali) {
      characteristicFilters.push({
        characteristics: {
          some: {
            name: { contains: 'locali', mode: 'insensitive' },
            value: criteria.locali.toString()
          }
        }
      })
    }

    if (characteristicFilters.length > 0) {
      whereConditions.AND = characteristicFilters
    }

    return await prisma.product.findMany({
      where: whereConditions,
      include: {
        characteristics: true,
        categories: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Genera risposta personalizzata con risultati
   */
  static async generateSearchResponse(
    criteria: SearchCriteria, 
    products: Product[], 
    originalMessage: string
  ): Promise<string> {
    
    if (products.length === 0) {
      return `Mi dispiace, non ho trovato appartamenti che corrispondono ai tuoi criteri:
${criteria.superficie ? `- Superficie: ${criteria.superficie.min}-${criteria.superficie.max} mq` : ''}
${criteria.locali ? `- Locali: ${criteria.locali}` : ''}
${criteria.prezzo ? `- Prezzo: €${criteria.prezzo.min}-${criteria.prezzo.max}` : ''}

Vuoi che ti mostri le opzioni più simili disponibili? 🏠`
    }

    const productList = products.slice(0, 3).map(p => {
      const superficie = p.characteristics.find(c => 
        c.name.toLowerCase().includes('superficie')
      )?.value
      
      return `🏠 **${p.name}**
💰 €${p.price.toLocaleString()}
📐 ${superficie ? `${superficie} mq` : 'Superficie da definire'}
📍 ${p.description?.substring(0, 100)}...`
    }).join('\n\n')

    return `Ho trovato ${products.length} appartament${products.length === 1 ? 'o' : 'i'} che corrispondono alla tua ricerca:

${productList}

${products.length > 3 ? `\n... e altri ${products.length - 3} risultati` : ''}

Vuoi maggiori dettagli su qualcuno di questi? 🔍`
  }
}
```

### 🔄 Integration nel Router Agent

```typescript
// Nel router-agent prompt
`
Se l'utente cerca prodotti con caratteristiche specifiche (es. "piso de 40mq", "appartamento 3 locali"), 
usa la funzione search_products_by_criteria:

ESEMPI:
- "dammi un piso de 40mq" → search_products_by_criteria
- "appartamento 2 locali zona centro" → search_products_by_criteria  
- "casa con giardino sotto 200k" → search_products_by_criteria

NON usare search_products generica, ma search_products_by_criteria per ricerche specifiche.
`

// Function calling
const functions = [
  {
    name: 'search_products_by_criteria',
    description: 'Cerca prodotti con criteri specifici estratti dal messaggio',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Messaggio originale utente' },
        workspaceId: { type: 'string' }
      }
    }
  }
]
```

### 📊 Database Schema per Characteristics

```sql
-- Già presente in schema.prisma
model ProductCharacteristic {
  id        String  @id @default(cuid())
  productId String
  name      String  -- "superficie", "locali", "piano"
  value     String  -- "40", "2", "primo"
  unit      String? -- "mq", "n.", null
  type      String  @default("text") -- "number", "text", "boolean"
  
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  @@map("product_characteristics")
}

-- Index per performance
CREATE INDEX idx_characteristics_search ON product_characteristics(name, value);
```

### 🧪 Test Cases

```typescript
// __tests__/smart-filter.test.ts
describe('SmartFilterService', () => {
  test('estrae criteri da "piso de 40mq"', async () => {
    const criteria = await SmartFilterService.extractSearchCriteria(
      'dammi un piso de 40mq',
      workspace
    )
    
    expect(criteria.superficie.min).toBe(35)
    expect(criteria.superficie.max).toBe(45)
    expect(criteria.confidence).toBeGreaterThan(0.7)
  })

  test('filtra prodotti per superficie', async () => {
    const products = await SmartFilterService.filterProducts({
      superficie: { min: 35, max: 45 }
    }, workspaceId)
    
    expect(products.length).toBeGreaterThan(0)
    products.forEach(p => {
      const superficie = p.characteristics.find(c => 
        c.name.includes('superficie')
      )
      expect(parseInt(superficie.value)).toBeBetween(35, 45)
    })
  })
})
```

---

## 🎯 Risultato Finale

### ✅ Form Dinamiche
- **UI/UX**: Bottone "+" elegante, drag&drop, preset templates
- **Flessibilità**: Supporta text, number, select, boolean
- **Business-specific**: Template per real estate, fashion, food

### ✅ LLM Filtering Intelligente  
- **Estrazione**: GPT-4 estrae criteri da linguaggio naturale
- **Matching**: Filtra per caratteristiche custom nel database
- **Response**: Genera risposte personalizzate con risultati

### 🔍 Esempio Completo
```
User: "dammi un piso de 40mq zona centro"
↓
LLM estrae: { superficie: {min:35, max:45}, zona: "centro" }
↓  
DB filtra: WHERE superficie BETWEEN 35-45 AND description CONTAINS "centro"
↓
Response: "Ho trovato 3 appartamenti che corrispondono..."
```

**Questo risolve il problema del filtraggio specifico mantenendo UX fluida! 🎯**