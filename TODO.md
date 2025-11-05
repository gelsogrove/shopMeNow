# 🎯 TODO: Intelligent Product Search with LLM (Zero Mapping)

## 📋 Project Overview

**Obiettivo**: Sostituire il sistema di ricerca prodotti con mapping hardcodati italiani con un sistema intelligente basato su LLM che supporta multi-lingua, ricerca per fornitore, e ricerca regionale.

**Problema attuale**: 
- Mapping hardcodati solo in italiano (`latticini → Cheeses`, `integrale → whole-grain`)
- Query in altre lingue falliscono (`dairy`, `salsa de carne` → 0 risultati)
- Nessuna ricerca per fornitore o regione
- Sistema non scalabile (ogni nuovo termine richiede aggiornamento mapping)

**Soluzione**:
```
Router Agent (LLM principale)
    ↓
Product Search Agent (SUB LLM) ← già esistente
    ↓
Query Analyzer Agent (SUB-SUB LLM) ← NUOVO! Dinamico da agentConfig
    ↓
ProductRepository → Database
```

**Architettura SUB-SUB LLM**:
- Config dinamica da tabella `agentConfig` (prompt, model, temperature)
- LLM riceve categorie/suppliers REALI dal database
- Zero mapping hardcodati - LLM fa matching intelligente
- Debug completo visibile in interfaccia web

---

## 🎯 USER STORY 1: Setup Campo Region per Ricerca Regionale

**Come** amministratore del sistema  
**Voglio** poter assegnare una regione italiana ad ogni prodotto  
**Così che** i clienti possano cercare "prodotti sardi", "formaggi toscani", etc.

**Acceptance Criteria**:
- ✅ Campo `region` aggiunto al model Products (String, nullable)
- ✅ Dropdown con 20 regioni italiane in inglese nel CRUD prodotti
- ✅ Seed popola prodotti con regioni appropriate
- ✅ ProductRepository cerca anche nel campo `region`
- ✅ Frontend mostra colonna region nella lista prodotti

### Task 1.1: Migration Prisma campo region
**File**: `backend/prisma/schema.prisma`

**Azioni**:
1. Aggiungere campo `region String?` al model Products (dopo `transportType`)
2. Eseguire: `cd backend && npx prisma migrate dev --name add_region_to_products`
3. Verificare migration creata in `prisma/migrations/`

**Codice da aggiungere**:
```prisma
model Products {
  // ... existing fields ...
  transportType  String   @default("Temperatura ambiente")
  region         String?  // ← NEW: Italian region in English
  allergens      String[]  @default([])
  // ...
}
```

---

### Task 1.2: Seed con regioni prodotti + certifications
**File**: `backend/prisma/seed.ts`

**Azioni**:
1. Aggiungere array `italianRegions` con 20 regioni in inglese
2. Logica per assegnare region ai prodotti basata su nome/tipo
3. Assicurarsi che prodotti abbiano certifications boolean per test:
   - Almeno 3 prodotti con `isWholeGrain: true` (pasta integrale)
   - Almeno 5 prodotti con `isHalal: true` (carni certificate)
   - Almeno 4 prodotti con `isOrganic: true` (bio)
   - Almeno 3 prodotti con `isVegan: true`
   - Almeno 2 prodotti con `isGlutenFree: true`

**Regioni da usare (in inglese)**:
```typescript
const italianRegions = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piedmont", "Apulia", "Sardinia", "Sicily",
  "Tuscany", "Trentino-Alto Adige", "Umbria", "Aosta Valley", "Veneto"
]
```

**Mapping prodotti → regioni**:
```typescript
// Esempi logica assegnazione:
if (prod.name.includes("Parmigiano")) prod.region = "Emilia-Romagna"
if (prod.name.includes("Pecorino Romano")) prod.region = "Lazio"
if (prod.name.includes("Pecorino Sardo")) prod.region = "Sardinia"
if (prod.name.includes("Mozzarella di Bufala")) prod.region = "Campania"
if (prod.name.includes("Gorgonzola")) prod.region = "Lombardia"
if (prod.name.includes("Fontina")) prod.region = "Aosta Valley"
if (prod.name.includes("Taleggio")) prod.region = "Lombardia"
if (prod.categoryName === "Pasta") prod.region = randomChoice(["Emilia-Romagna", "Campania", "Sicily"])
// Default per altri: random region o null
```

**Eseguire seed**:
```bash
cd backend && npm run seed
```

---

### Task 1.3: ProductRepository ricerca per region
**File**: `backend/src/repositories/product.repository.ts`

**Metodo**: `searchProducts()`

**Azioni**:
1. Trovare l'array `orConditions` nella ricerca keyword (linea ~410-425)
2. Aggiungere condizione per campo `region`:
   ```typescript
   { region: { contains: keyword, mode: "insensitive" } }
   ```
3. Ora query "sardi" troverà prodotti con `region: "Sardinia"`

**Contesto**: Questo permette ricerca keyword anche sul campo region. Es: "prodotti sardi" cerca in tutti i campi incluso `region`.

---

### Task 1.4: ProductRepository filtro supplierIds
**File**: `backend/src/repositories/product.repository.ts`

**Metodo**: `searchProducts()`

**Azioni**:
1. Aggiungere parametro `supplierIds?: string[]` in `SearchFilters` interface
2. Nella costruzione del `where` object, aggiungere:
   ```typescript
   if (filters.supplierIds && filters.supplierIds.length > 0) {
     where.supplierId = { in: filters.supplierIds }
   }
   ```

**Contesto**: Il QueryAnalyzerAgent LLM ritornerà `supplierIds` estratti dalla query. Esempio: "prodotti di Rossi Formaggi" → LLM trova supplier ID → filtro applicato.

---

### Task 1.5: Frontend campo region in CRUD
**File**: `frontend/src/pages/ProductsPage.tsx`

**Azioni**:
1. Aggiungere state `region` nel form prodotto
2. Creare dropdown/select con le 20 regioni italiane (inglese)
3. In create/update product: inviare campo `region` al backend

**Codice esempio**:
```tsx
const italianRegions = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piedmont", "Apulia", "Sardinia", "Sicily",
  "Tuscany", "Trentino-Alto Adige", "Umbria", "Aosta Valley", "Veneto"
]

// Nel form:
<Select value={region} onValueChange={setRegion}>
  <SelectTrigger>
    <SelectValue placeholder="Select region (optional)" />
  </SelectTrigger>
  <SelectContent>
    {italianRegions.map(r => (
      <SelectItem key={r} value={r}>{r}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

### Task 1.6: Frontend colonna region in tabella
**File**: `frontend/src/pages/ProductsPage.tsx`

**Azioni**:
1. Aggiungere `<TableHead>Region</TableHead>` nell'header
2. Aggiungere `<TableCell>{product.region || '-'}</TableCell>` nel body
3. Posizionare dopo colonna "Transport Type"

---

## 🤖 USER STORY 2: Query Analyzer Agent - SUB-SUB LLM Dinamico

**Come** sviluppatore del sistema  
**Voglio** un agente LLM intelligente che analizza query di ricerca  
**Così che** non servano più mapping hardcodati e il sistema supporti multi-lingua automaticamente

**Acceptance Criteria**:
- ✅ Nuovo agent `QueryAnalyzerAgent` configurabile in `agentConfig` table
- ✅ LLM riceve categorie/suppliers reali dal DB (zero hardcoded)
- ✅ Query in qualsiasi lingua ritornano categoryIds/supplierIds corretti
- ✅ Certifications estratte intelligentemente (halal, vegan, bio, etc)
- ✅ Region e transportType identificati da LLM
- ✅ Error handling con fallback keyword-based
- ✅ Debug info completo ritornato (prompt, response, timing)

---

### Task 2.1: Tabella agentConfig - QueryAnalyzerAgent
**File**: `backend/prisma/seed.ts`

**Azioni**:
1. Aggiungere nuovo agent nella sezione `agentConfigs`
2. Nome: `"QueryAnalyzerAgent"`
3. Tipo: `"query-analyzer"` (nuovo tipo)
4. Model: `"openai/gpt-4o-mini"`
5. Temperature: `0` (deterministico)
6. Max tokens: `500` (response JSON piccolo)

**Prompt system da aggiungere**:
```typescript
const queryAnalyzerPrompt = `You are an intelligent product search query analyzer.

Your task: analyze user search queries in ANY language and extract structured filters.

CONTEXT - Available in this workspace:
Categories: {{categories}}
Suppliers: {{suppliers}}

USER QUERY: {{query}}

EXTRACT:
1. categoryIds: Match query to category names (return UUIDs). Example: "dairy"/"latticini"/"lácteos" all match category "Cheeses"
2. supplierIds: Match query to supplier names (return UUIDs). Example: "Rossi products" matches supplier "Rossi Formaggi"
3. certifications: Array of certification types found. Options: ["halal", "vegan", "gluten-free", "whole-grain", "organic"]
4. transportType: Transport requirement. Options: "Temperatura ambiente" | "Refrigerato" | "Surgelato" | null
5. region: Italian region mentioned. Examples: "Sardinia", "Tuscany", "Emilia-Romagna" (in English) | null
6. keywords: Array of search keywords not covered by above filters

RESPOND WITH VALID JSON ONLY:
{
  "categoryIds": ["uuid1", "uuid2"],
  "supplierIds": ["uuid3"],
  "certifications": ["halal", "organic"],
  "transportType": "Surgelato",
  "region": "Sardinia",
  "keywords": ["fresh", "artisanal"]
}

RULES:
- Match categories/suppliers intelligently (synonyms, translations, partial matches)
- If unsure about categoryId/supplierId, omit (don't guess UUIDs)
- Return empty arrays if nothing found
- Use null for transportType/region if not specified
- Be intelligent with multi-language: "queso" = "cheese" = "formaggio"
`

await prisma.agentConfig.create({
  data: {
    workspaceId,
    agentName: "QueryAnalyzerAgent",
    agentType: "query-analyzer",
    systemPrompt: queryAnalyzerPrompt,
    model: "openai/gpt-4o-mini",
    temperature: 0,
    maxTokens: 500,
    availableFunctions: [],
  }
})
```

**Eseguire**:
```bash
cd backend && npm run seed
```

---

### Task 2.2: Creare QueryAnalyzerAgentLLM.ts
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Azioni**:
1. Creare nuovo file seguendo pattern di `ProductSearchAgentLLM.ts`
2. Constructor: riceve `workspaceId`, carica config da DB
3. Metodo principale: `async analyzeQuery(query: string)`
4. Metodo interno: `async callLLM(prompt: string)`

**Struttura classe**:
```typescript
import { PrismaClient } from "@prisma/client"
import logger from "../../utils/logger"

export interface QueryAnalysis {
  categoryIds: string[]
  supplierIds: string[]
  certifications: {
    isHalal?: boolean
    isVegan?: boolean
    isGlutenFree?: boolean
    isWholeGrain?: boolean
    isOrganic?: boolean
  }
  transportType: string | null
  region: string | null
  keywords: string[]
}

export interface QueryAnalyzerDebug {
  systemPrompt: string
  userPrompt: string
  categoriesFromDB: Array<{ id: string; name: string }>
  suppliersFromDB: Array<{ id: string; companyName: string }>
  llmRawResponse: string
  llmParsed: any
  executionTimeMs: number
}

export class QueryAnalyzerAgentLLM {
  private prisma: PrismaClient
  private workspaceId: string
  private agentConfig: any
  private openRouterApiKey: string

  constructor(workspaceId: string) {
    this.prisma = new PrismaClient()
    this.workspaceId = workspaceId
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    
    if (!this.openRouterApiKey) {
      logger.error("OPENROUTER_API_KEY is required for QueryAnalyzerAgent")
    }
  }

  async initialize() {
    // Load config from DB
    this.agentConfig = await this.prisma.agentConfig.findFirst({
      where: {
        workspaceId: this.workspaceId,
        agentName: "QueryAnalyzerAgent"
      }
    })

    if (!this.agentConfig) {
      throw new Error("QueryAnalyzerAgent config not found in agentConfig table")
    }
  }

  async analyzeQuery(query: string): Promise<{
    analysis: QueryAnalysis
    debug: QueryAnalyzerDebug
  }> {
    // Implementation in next tasks
  }

  private async callLLM(prompt: string): Promise<string> {
    // Implementation in Task 2.6
  }

  private mapCertifications(certArray: string[]): QueryAnalysis["certifications"] {
    // Implementation in Task 2.8
  }
}
```

---

### Task 2.3: QueryAnalyzer - query DB categorie
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `analyzeQuery()`

**Azioni**:
1. All'inizio del metodo, fare query categorie:
   ```typescript
   const categories = await this.prisma.categories.findMany({
     where: { workspaceId: this.workspaceId, isActive: true },
     select: { id: true, name: true }
   })
   ```
2. Salvare in variabile per debug e per passare a LLM

**Contesto**: Categorie REALI dal DB - nessun hardcoding! Se admin aggiunge categoria "Salse", LLM lo vedrà automaticamente.

---

### Task 2.4: QueryAnalyzer - query DB suppliers
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `analyzeQuery()`

**Azioni**:
1. Dopo query categorie, fare query suppliers:
   ```typescript
   const suppliers = await this.prisma.suppliers.findMany({
     where: { workspaceId: this.workspaceId, isActive: true },
     select: { id: true, companyName: true }
   })
   ```
2. Salvare per debug e prompt LLM

**Contesto**: Query "prodotti di Rossi Formaggi" → LLM vede lista suppliers → match intelligente → ritorna UUID supplier.

---

### Task 2.5: QueryAnalyzer - costruire prompt dinamico
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `analyzeQuery()`

**Azioni**:
1. Prendere `systemPrompt` da `this.agentConfig.systemPrompt`
2. Sostituire variabili con `PromptProcessorService`:
   ```typescript
   const promptProcessor = new PromptProcessorService()
   
   const categoriesStr = categories.map(c => `${c.name} (${c.id})`).join(", ")
   const suppliersStr = suppliers.map(s => `${s.companyName} (${s.id})`).join(", ")
   
   const processedPrompt = promptProcessor.replaceAllVariables(
     this.agentConfig.systemPrompt,
     {
       categories: categoriesStr,
       suppliers: suppliersStr,
       query: query
     }
   )
   ```

**Contesto**: Prompt dinamico da DB con categorie/suppliers reali iniettati. Zero hardcoding!

---

### Task 2.6: QueryAnalyzer - chiamata OpenRouter
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `callLLM()`

**Azioni**:
1. Implementare chiamata fetch a OpenRouter API:
   ```typescript
   private async callLLM(prompt: string): Promise<string> {
     const startTime = Date.now()
     
     const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${this.openRouterApiKey}`,
         "Content-Type": "application/json",
         "HTTP-Referer": "https://shopme.ai",
         "X-Title": "ShopME Query Analyzer"
       },
       body: JSON.stringify({
         model: this.agentConfig.model,
         messages: [
           { role: "system", content: prompt }
         ],
         response_format: { type: "json_object" },
         temperature: this.agentConfig.temperature || 0,
         max_tokens: this.agentConfig.maxTokens || 500
       })
     })
     
     if (!response.ok) {
       throw new Error(`OpenRouter API error: ${response.statusText}`)
     }
     
     const data = await response.json()
     const executionTime = Date.now() - startTime
     
     logger.info(`🤖 QueryAnalyzer LLM responded in ${executionTime}ms`)
     
     return data.choices[0].message.content
   }
   ```

**Contesto**: `response_format: json_object` forza LLM a ritornare JSON valido. Temperature 0 = deterministico.

---

### Task 2.7: QueryAnalyzer - parse JSON response
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `analyzeQuery()`

**Azioni**:
1. Dopo chiamata LLM, parsare risposta:
   ```typescript
   const llmRawResponse = await this.callLLM(processedPrompt)
   const llmParsed = JSON.parse(llmRawResponse)
   
   // Validate structure
   if (!llmParsed.categoryIds || !Array.isArray(llmParsed.categoryIds)) {
     logger.warn("Invalid LLM response: missing categoryIds array")
     llmParsed.categoryIds = []
   }
   
   // Similar validation for supplierIds, certifications, keywords
   ```

**Contesto**: LLM può sbagliare formato - validazione necessaria prima di usare dati.

---

### Task 2.8: QueryAnalyzer - mapping certifications
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `mapCertifications()`

**Azioni**:
1. Convertire array certifications da LLM in oggetto boolean:
   ```typescript
   private mapCertifications(certArray: string[]): QueryAnalysis["certifications"] {
     const certMap: QueryAnalysis["certifications"] = {}
     
     if (certArray.includes("halal")) certMap.isHalal = true
     if (certArray.includes("vegan")) certMap.isVegan = true
     if (certArray.includes("gluten-free")) certMap.isGlutenFree = true
     if (certArray.includes("whole-grain")) certMap.isWholeGrain = true
     if (certArray.includes("organic") || certArray.includes("bio")) {
       certMap.isOrganic = true
     }
     
     return certMap
   }
   ```

**Contesto**: Questo è l'UNICO mapping necessario - converte nomi certifications in campi DB boolean. Minimo indispensabile!

---

### Task 2.9: QueryAnalyzer - error handling
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `analyzeQuery()`

**Azioni**:
1. Wrappare tutta la logica in try/catch:
   ```typescript
   try {
     // ... LLM call and parsing ...
   } catch (error) {
     logger.error("❌ QueryAnalyzer LLM failed:", error)
     
     // Fallback: keyword-based search
     return {
       analysis: {
         categoryIds: [],
         supplierIds: [],
         certifications: {},
         transportType: null,
         region: null,
         keywords: [query] // fallback to simple keyword search
       },
       debug: {
         systemPrompt: "",
         userPrompt: query,
         categoriesFromDB: [],
         suppliersFromDB: [],
         llmRawResponse: `ERROR: ${error.message}`,
         llmParsed: null,
         executionTimeMs: 0
       }
     }
   }
   ```

**Contesto**: Se LLM fallisce, sistema continua a funzionare con ricerca keyword base.

---

### Task 2.10: QueryAnalyzer - ritorna debug info
**File**: `backend/src/application/agents/QueryAnalyzerAgentLLM.ts`

**Metodo**: `analyzeQuery()`

**Azioni**:
1. Alla fine del metodo, ritornare analisi + debug completo:
   ```typescript
   return {
     analysis: {
       categoryIds: llmParsed.categoryIds || [],
       supplierIds: llmParsed.supplierIds || [],
       certifications: this.mapCertifications(llmParsed.certifications || []),
       transportType: llmParsed.transportType || null,
       region: llmParsed.region || null,
       keywords: llmParsed.keywords || []
     },
     debug: {
       systemPrompt: processedPrompt,
       userPrompt: query,
       categoriesFromDB: categories,
       suppliersFromDB: suppliers,
       llmRawResponse: llmRawResponse,
       llmParsed: llmParsed,
       executionTimeMs: Date.now() - startTime
     }
   }
   ```

**Contesto**: Debug info permette di vedere TUTTO il flusso LLM nell'interfaccia web. Trasparenza totale!

---

## 🔧 USER STORY 3: Integrare QueryAnalyzerAgent in DebugController

**Come** sviluppatore  
**Voglio** sostituire il vecchio sistema con mapping hardcodati  
**Così che** il DebugController usi il nuovo QueryAnalyzerAgent LLM

**Acceptance Criteria**:
- ✅ DebugController istanzia QueryAnalyzerAgent dinamicamente
- ✅ Vecchio metodo `analyzeQuery()` con mapping eliminato
- ✅ API response include debug LLM completo
- ✅ Zero mapping hardcodati rimasti nel codice

---

### Task 3.1: DebugController - istanziare QueryAnalyzerAgent
**File**: `backend/src/interfaces/http/controllers/debug.controller.ts`

**Metodo**: `searchProducts()`

**Azioni**:
1. All'inizio del metodo, dopo validazione query:
   ```typescript
   // Initialize QueryAnalyzerAgent
   const queryAnalyzer = new QueryAnalyzerAgentLLM(workspaceId)
   await queryAnalyzer.initialize()
   
   logger.info("🤖 QueryAnalyzerAgent initialized for workspace", { workspaceId })
   ```

**Contesto**: Ogni workspace può avere config LLM diversa (model, prompt, temperature). Caricamento dinamico da DB!

---

### Task 3.2: DebugController - chiamare analyzeQuery()
**File**: `backend/src/interfaces/http/controllers/debug.controller.ts`

**Metodo**: `searchProducts()`

**Azioni**:
1. Sostituire chiamata vecchia con nuova:
   ```typescript
   // OLD (DELETE):
   // const queryAnalysis = this.analyzeQuery(query)
   
   // NEW:
   const { analysis, debug } = await queryAnalyzer.analyzeQuery(query)
   
   logger.info("📊 Query Analysis Result", { analysis })
   ```

---

### Task 3.3: DebugController - rimuovere analyzeQuery() vecchio
**File**: `backend/src/interfaces/http/controllers/debug.controller.ts`

**Azioni**:
1. Eliminare COMPLETAMENTE il metodo privato `analyzeQuery()`
2. Eliminare gli oggetti:
   - `categoryMappings`
   - `attributeMappings`
   - `certificationMappings`
3. Verificare che nessun import/codice dipenda da questi mapping

**Contesto**: **ZERO MAPPING HARDCODATI!** Tutto dinamico via LLM!

---

### Task 3.4: DebugController - API response con debug LLM
**File**: `backend/src/interfaces/http/controllers/debug.controller.ts`

**Metodo**: `searchProducts()`

**Azioni**:
1. Modificare response JSON per includere debug:
   ```typescript
   return res.json({
     success: true,
     query: analysis, // analysis from LLM
     filters: filters,
     results: results,
     totalFound: results.length,
     executionTimeMs: executionTimeMs,
     llmDebug: debug // ← NEW! Complete LLM trace
   })
   ```

**Contesto**: Frontend riceve tutto: prompt, categorie DB, raw response, parsed JSON, timing. Trasparenza totale!

---

## 🎨 USER STORY 4: Debug UI - Visualizzare Comunicazione LLM

**Come** amministratore  
**Voglio** vedere tutto il flusso di comunicazione con l'LLM  
**Così che** possa capire come funziona il sistema e debuggare problemi

**Acceptance Criteria**:
- ✅ Nuova sezione "LLM Communication" nella pagina debug
- ✅ System prompt visualizzato (collapsible)
- ✅ Categorie/Suppliers dal DB mostrati
- ✅ Raw response LLM con syntax highlighting JSON
- ✅ Parsed analysis con highlight campi
- ✅ Execution time LLM mostrato

---

### Task 4.1: Frontend - sezione LLM Communication
**File**: `frontend/src/pages/debug/ProductSearchDebug.tsx`

**Azioni**:
1. Aggiungere state per debug LLM:
   ```typescript
   const [llmDebug, setLlmDebug] = useState<any>(null)
   ```
2. In `handleSearch()`, salvare debug da response:
   ```typescript
   setLlmDebug(response.data.llmDebug)
   ```
3. Aggiungere nuova sezione dopo form search, prima dei risultati:
   ```tsx
   {llmDebug && (
     <Card className="mb-6">
       <CardHeader>
         <CardTitle className="text-lg">🤖 LLM Communication</CardTitle>
       </CardHeader>
       <CardContent>
         {/* Subsections in next tasks */}
       </CardContent>
     </Card>
   )}
   ```

---

### Task 4.2: Frontend - installare react-json-view
**Directory**: `frontend/`

**Azioni**:
1. Installare libreria:
   ```bash
   cd frontend && npm install react-json-view
   ```
2. Aggiungere import in `ProductSearchDebug.tsx`:
   ```typescript
   import ReactJson from 'react-json-view'
   ```

**Contesto**: Libreria per mostrare JSON con syntax highlighting, collapsible, e copy to clipboard.

---

### Task 4.3: Frontend - mostrare System Prompt
**File**: `frontend/src/pages/debug/ProductSearchDebug.tsx`

**Azioni**:
1. Dentro sezione LLM Communication:
   ```tsx
   <Collapsible>
     <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-blue-600">
       📤 System Prompt (click to expand)
     </CollapsibleTrigger>
     <CollapsibleContent className="mt-2">
       <pre className="bg-blue-50 p-4 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
         {llmDebug.systemPrompt}
       </pre>
     </CollapsibleContent>
   </Collapsible>
   ```

**Contesto**: System prompt può essere lungo - collapsible evita clutter.

---

### Task 4.4: Frontend - mostrare Categorie/Suppliers DB
**File**: `frontend/src/pages/debug/ProductSearchDebug.tsx`

**Azioni**:
1. Card per mostrare contesto DB:
   ```tsx
   <div className="mt-4 p-4 bg-gray-50 rounded">
     <h4 className="font-medium text-sm mb-2">📚 Database Context</h4>
     <div className="grid grid-cols-2 gap-4">
       <div>
         <p className="text-xs font-medium mb-1">Categories ({llmDebug.categoriesFromDB.length})</p>
         <div className="text-xs space-y-1">
           {llmDebug.categoriesFromDB.map(c => (
             <div key={c.id} className="text-gray-600">
               • {c.name}
             </div>
           ))}
         </div>
       </div>
       <div>
         <p className="text-xs font-medium mb-1">Suppliers ({llmDebug.suppliersFromDB.length})</p>
         <div className="text-xs space-y-1">
           {llmDebug.suppliersFromDB.map(s => (
             <div key={s.id} className="text-gray-600">
               • {s.companyName}
             </div>
           ))}
         </div>
       </div>
     </div>
   </div>
   ```

**Contesto**: Mostra cosa vede l'LLM - liste reali dal DB!

---

### Task 4.5: Frontend - mostrare User Prompt
**File**: `frontend/src/pages/debug/ProductSearchDebug.tsx`

**Azioni**:
1. Badge per query utente:
   ```tsx
   <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
     <p className="text-xs font-medium text-green-800 mb-1">💬 User Query</p>
     <p className="text-sm font-mono">{llmDebug.userPrompt}</p>
   </div>
   ```

---

### Task 4.6: Frontend - mostrare LLM Raw Response
**File**: `frontend/src/pages/debug/ProductSearchDebug.tsx`

**Azioni**:
1. Collapsible con ReactJson:
   ```tsx
   <Collapsible className="mt-4">
     <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-yellow-600">
       📥 LLM Raw Response (click to expand)
     </CollapsibleTrigger>
     <CollapsibleContent className="mt-2">
       <ReactJson
         src={JSON.parse(llmDebug.llmRawResponse)}
         theme="monokai"
         collapsed={false}
         displayDataTypes={false}
         enableClipboard={true}
       />
     </CollapsibleContent>
   </Collapsible>
   ```

**Contesto**: JSON interattivo - espandibile, copiabile.

---

### Task 4.7: Frontend - mostrare Parsed Analysis
**File**: `frontend/src/pages/debug/ProductSearchDebug.tsx`

**Azioni**:
1. Card con parsed data highlight:
   ```tsx
   <div className="mt-4 p-4 bg-green-50 rounded">
     <h4 className="font-medium text-sm mb-2">✅ Parsed Analysis</h4>
     <ReactJson
       src={llmDebug.llmParsed}
       theme="summerfruit:inverted"
       collapsed={false}
       displayDataTypes={false}
     />
   </div>
   ```

---

### Task 4.8: Frontend - mostrare Execution Time
**File**: `frontend/src/pages/debug/ProductSearchDebug.tsx`

**Azioni**:
1. Badge con timing:
   ```tsx
   <div className="mt-4">
     <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
       ⏱️ LLM Execution: {llmDebug.executionTimeMs}ms
     </span>
   </div>
   ```

---

## ✅ USER STORY 5: Testing Multi-Lingua + Supplier + Region

**Come** QA tester  
**Voglio** verificare che il sistema funzioni in tutte le lingue e con tutti i filtri  
**Così che** possiamo garantire qualità del sistema

**Acceptance Criteria**:
- ✅ Query italiano funzionano correttamente
- ✅ Query inglese funzionano correttamente  
- ✅ Query spagnolo funzionano correttamente
- ✅ Query portoghese funzionano correttamente
- ✅ Ricerca per supplier funziona
- ✅ Ricerca per region funziona
- ✅ Debug LLM visibile per ogni test

---

### Task 5.1: Verificare OPENROUTER_API_KEY
**File**: `backend/.env`

**Azioni**:
1. Aprire file `.env`
2. Verificare presenza di:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
3. Se manca, aggiungerla (chiedere ad Andrea la key)

---

### Task 5.2: Test query italiano
**Browser**: `http://localhost:3000/debug/search`

**Test cases**:
```
1. Query: "latticini"
   Expected: Prodotti categoria Cheeses
   Verify: llmDebug mostra categoryIds corretto

2. Query: "pasta integrale"
   Expected: Prodotti con isWholeGrain=true
   Verify: llmDebug mostra certifications: ["whole-grain"]

3. Query: "surgelati"
   Expected: Prodotti con transportType="Surgelato"
   Verify: llmDebug mostra transportType: "Surgelato"

4. Query: "prodotti sardi"
   Expected: Prodotti con region="Sardinia"
   Verify: llmDebug mostra region: "Sardinia"
```

---

### Task 5.3: Test query inglese
**Browser**: `http://localhost:3000/debug/search`

**Test cases**:
```
1. Query: "dairy"
   Expected: Prodotti categoria Cheeses
   Verify: LLM traduce "dairy" → categoryIds Cheeses

2. Query: "wholegrain pasta"
   Expected: Prodotti categoria Pasta + isWholeGrain=true
   Verify: LLM estrae sia category che certification

3. Query: "frozen products"
   Expected: Prodotti transportType="Surgelato"
   Verify: LLM capisce "frozen" = "Surgelato"
```

---

### Task 5.4: Test query spagnolo
**Browser**: `http://localhost:3000/debug/search`

**Test cases**:
```
1. Query: "productos lácteos"
   Expected: Prodotti categoria Cheeses
   Verify: LLM traduce spagnolo → italiano

2. Query: "salsa de carne"
   Expected: Prodotti con "carne" o "salsa" nel nome
   Verify: LLM estrae keywords corretti
```

---

### Task 5.5: Test query portoghese
**Browser**: `http://localhost:3000/debug/search`

**Test cases**:
```
1. Query: "queijos"
   Expected: Prodotti categoria Cheeses
   Verify: LLM capisce portoghese

2. Query: "massa integral"
   Expected: Pasta + wholegrain
   Verify: Multi-lingua funziona
```

---

### Task 5.6: Test ricerca supplier
**Browser**: `http://localhost:3000/debug/search`

**Test cases**:
```
1. Query: "prodotti di Rossi Formaggi"
   Expected: Solo prodotti supplier "Rossi Formaggi"
   Verify: llmDebug mostra supplierIds con UUID Rossi

2. Query: "Bella Italia cheese"
   Expected: Prodotti supplier "Bella Italia" + categoria Cheeses
   Verify: LLM estrae sia supplier che category
```

---

### Task 5.7: Test ricerca region
**Browser**: `http://localhost:3000/debug/search`

**Test cases**:
```
1. Query: "prodotti sardi"
   Expected: Prodotti region="Sardinia"
   Verify: llmDebug mostra region: "Sardinia"

2. Query: "formaggi toscani"
   Expected: Cheeses + region="Tuscany"
   Verify: LLM combina category + region filter
```

---

## 📊 Summary

**Total Tasks**: 40
- FASE 1 (Region setup): 6 tasks
- FASE 2 (SUB-SUB LLM): 10 tasks
- FASE 3 (Integration): 4 tasks
- FASE 4 (Debug UI): 8 tasks
- FASE 5 (Testing): 7 tasks

**Key Technologies**:
- OpenRouter API (gpt-4o-mini)
- Prisma ORM
- React + TypeScript
- shadcn/ui components
- react-json-view

**Success Criteria**:
✅ Zero hardcoded mappings
✅ Multi-language support (IT/EN/ES/PT/...)
✅ Intelligent supplier matching
✅ Regional product search
✅ Complete LLM transparency in debug UI
✅ Fallback to keyword search if LLM fails

---

## 🚀 Getting Started

1. Start with FASE 1 (database + seed)
2. Implement FASE 2 (SUB-SUB LLM agent)
3. Integrate FASE 3 (DebugController)
4. Build FASE 4 (Debug UI)
5. Test FASE 5 (all languages + filters)

**Order of execution**: Sequential - each phase depends on previous!
