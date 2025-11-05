import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/hooks/use-workspace"
import { api } from "@/services/api"
import { Loader2 } from "lucide-react"
import { useState } from "react"

interface SearchResult {
  success: boolean
  query: {
    keywords?: string[]
    categoryNames?: string[]
    attributes?: string[]
    certifications?: string[]
  }
  filters?: any
  results: any[]
  totalFound: number
  executionTimeMs: number
}

export function ProductSearchDebug() {
  const { workspace } = useWorkspace()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim() || !workspace) return

    setLoading(true)
    setError(null)

    try {
      const sessionId = localStorage.getItem("sessionId") || ""
      const response = await api.post(
        `/workspaces/${workspace.id}/debug/search-products`,
        { query: searchQuery },
        {
          headers: {
            "x-session-id": sessionId,
          },
        }
      )

      setSearchResults(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || "Search failed")
      console.error("Search error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleSearch(e as any)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🔍 Product Search Debug</h1>
          <p className="text-gray-600 mt-1">
            Testa le query di ricerca e vedi i risultati esatti dal database
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          TEST ONLY
        </Badge>
      </div>

      {/* SEARCH INPUT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ricerca Prodotto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder='Esempio: "mozzarella", "halal", "integrali", "latticini fresco"'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ricerca...
                </>
              ) : (
                "Cerca"
              )}
            </Button>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
              ❌ {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RESULTS */}
      {searchResults && (
        <div className="space-y-4">
          {/* QUERY ANALYSIS */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-base">📋 Query Analizzata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-white p-3 rounded overflow-auto max-h-40 border">
                {JSON.stringify(searchResults.query, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* STATS */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-green-600">
                  {searchResults.totalFound}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Prodotti Trovati
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-purple-600">
                  {searchResults.executionTimeMs}ms
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Tempo Esecuzione
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-orange-600">
                  {searchResults.results.length}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Risultati Mostrati (max 20)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PRODUCTS LIST */}
          {searchResults.results.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  📦 Risultati ({searchResults.results.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[600px] overflow-auto">
                  {searchResults.results.map((product) => {
                    // Funzione per evidenziare il testo cercato
                    const highlightText = (text: string) => {
                      if (!text) return ""
                      const query = searchQuery.toLowerCase()
                      if (!query) return text

                      const parts = text.split(new RegExp(`(${query})`, "gi"))
                      return parts
                        .map((part, i) =>
                          part.toLowerCase() === query
                            ? `<mark class="bg-yellow-300 px-1 rounded">${part}</mark>`
                            : part
                        )
                        .join("")
                    }

                    return (
                      <div
                        key={product.id}
                        className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition"
                      >
                        {/* TITOLO E CODICE */}
                        <div className="mb-3">
                          <h3
                            className="text-lg font-bold text-gray-900"
                            dangerouslySetInnerHTML={{
                              __html: highlightText(product.name),
                            }}
                          />
                          <div className="text-xs text-gray-600 mt-1">
                            🔹 Codice:{" "}
                            <code className="bg-gray-100 px-2 py-1 rounded">
                              {product.productCode}
                            </code>
                          </div>
                        </div>

                        {/* DESCRIZIONE */}
                        {product.description && (
                          <div className="mb-3 p-2 bg-gray-50 rounded border-l-4 border-blue-400">
                            <p
                              className="text-sm text-gray-700"
                              dangerouslySetInnerHTML={{
                                __html: highlightText(product.description),
                              }}
                            />
                          </div>
                        )}

                        {/* INFO PRINCIPALI - 2 COLONNE */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          {/* SINISTRA */}
                          <div className="space-y-2">
                            {/* CATEGORIA */}
                            <div>
                              <span className="text-xs font-semibold text-gray-600">
                                📂 CATEGORIA
                              </span>
                              <div
                                className="text-sm font-medium text-gray-900"
                                dangerouslySetInnerHTML={{
                                  __html: highlightText(
                                    product.category?.name || ""
                                  ),
                                }}
                              />
                            </div>

                            {/* TRASPORTO */}
                            <div>
                              <span className="text-xs font-semibold text-gray-600">
                                🚚 TRASPORTO
                              </span>
                              <div
                                className="text-sm font-medium text-gray-900"
                                dangerouslySetInnerHTML={{
                                  __html: highlightText(product.transportType),
                                }}
                              />
                            </div>
                          </div>

                          {/* DESTRA - PREZZO E STOCK */}
                          <div className="space-y-2">
                            {/* PREZZO */}
                            <div>
                              <span className="text-xs font-semibold text-gray-600">
                                💰 PREZZO
                              </span>
                              <div className="text-2xl font-bold text-green-600">
                                €{product.price.toFixed(2)}
                              </div>
                            </div>

                            {/* STOCK */}
                            <div>
                              <span className="text-xs font-semibold text-gray-600">
                                📦 STOCK
                              </span>
                              <div className="text-sm">
                                {product.stock > 0 ? (
                                  <span className="font-medium text-green-700">
                                    ✓ {product.stock} disponibili
                                  </span>
                                ) : (
                                  <span className="font-medium text-red-700">
                                    ✗ Esaurito
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CERTIFICAZIONI */}
                        {(product.isHalal ||
                          product.isVegan ||
                          product.isGlutenFree ||
                          product.isWholeGrain ||
                          product.isOrganic) && (
                          <div className="mb-3 p-2 bg-amber-50 rounded border border-amber-200">
                            <span className="text-xs font-semibold text-amber-800 block mb-2">
                              🏅 CERTIFICAZIONI
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              {product.isHalal && (
                                <Badge className="bg-green-500 text-white text-xs">
                                  ✅ Halal
                                </Badge>
                              )}
                              {product.isVegan && (
                                <Badge className="bg-emerald-500 text-white text-xs">
                                  🌱 Vegan
                                </Badge>
                              )}
                              {product.isGlutenFree && (
                                <Badge className="bg-orange-500 text-white text-xs">
                                  🌾 Gluten-Free
                                </Badge>
                              )}
                              {product.isWholeGrain && (
                                <Badge className="bg-yellow-600 text-white text-xs">
                                  🌰 Integrale
                                </Badge>
                              )}
                              {product.isOrganic && (
                                <Badge className="bg-lime-600 text-white text-xs">
                                  🌿 Bio
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* FOOTER */}
                        <div className="flex justify-between items-center pt-2 border-t text-xs text-gray-500">
                          <span>ID: {product.id.slice(0, 12)}...</span>
                          <span className="text-green-600 font-semibold">
                            Trovato ✓
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-red-50 border-2 border-red-200">
              <CardContent className="pt-6 text-center">
                <p className="text-lg text-red-700 font-semibold">
                  ❌ Nessun prodotto trovato
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Prova con una ricerca diversa
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* HELP */}
      {!searchResults && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">💡 Come Usare</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <p>
              • <strong>Ricerca Keyword:</strong> "mozzarella", "parmigiano"
            </p>
            <p>
              • <strong>Ricerca Certificazione:</strong> "halal", "vegan",
              "integrali", "senza glutine"
            </p>
            <p>
              • <strong>Ricerca Categoria:</strong> "latticini", "formaggi",
              "pasta", "dessert"
            </p>
            <p>
              • <strong>Ricerca Attributo:</strong> "fresco", "surgelato"
            </p>
            <p>
              • <strong>Ricerca Combinata:</strong> "latticini freschi halal",
              "pasta integrale"
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
