import { describe, it, expect, beforeEach, jest } from "@jest/globals"
import { matchAllPatterns } from "../patterns/pattern-matcher"
import { buildContextFromHistory, parseListFromMessage } from "../patterns/history-parser"
import { IntentType } from "../intent.types"

describe("IntentParser - Pattern Matcher", () => {
  describe("Identity patterns", () => {
    it("should match 'chi sei'", () => {
      const result = matchAllPatterns("chi sei?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.IDENTITY_QUERY)
    })

    it("should match 'chi siete'", () => {
      const result = matchAllPatterns("chi siete voi?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.IDENTITY_QUERY)
    })

    it("should match 'come ti chiami'", () => {
      const result = matchAllPatterns("come ti chiami?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.IDENTITY_QUERY)
    })

    it("should match 'cosa fai'", () => {
      const result = matchAllPatterns("cosa fai?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.IDENTITY_QUERY)
    })

    it("should match 'che servizi offrite'", () => {
      const result = matchAllPatterns("che servizi offrite?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.IDENTITY_QUERY)
    })
  })

  describe("Location patterns", () => {
    it("should match 'dove siete'", () => {
      const result = matchAllPatterns("dove siete?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.LOCATION_QUERY)
    })

    it("should match 'qual è il vostro indirizzo'", () => {
      const result = matchAllPatterns("qual è il vostro indirizzo?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.LOCATION_QUERY)
    })

    it("should match 'come raggiungervi'", () => {
      const result = matchAllPatterns("come posso raggiungervi?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.LOCATION_QUERY)
    })
  })

  describe("Catalog patterns", () => {
    it("should match 'categorie' query", () => {
      const result = matchAllPatterns("quali categorie avete?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.CATEGORY_LIST)
    })

    it("should match 'cosa vendete'", () => {
      const result = matchAllPatterns("cosa vendete?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.CATEGORY_LIST)
    })

    it("should match 'mostrami tutti i prodotti'", () => {
      const result = matchAllPatterns("mostrami tutti i prodotti")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.PRODUCT_LIST)
    })

    it("should match 'lista prodotti'", () => {
      const result = matchAllPatterns("lista prodotti")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.PRODUCT_LIST)
    })

    it("should match 'cerca vino rosso'", () => {
      const result = matchAllPatterns("cerca vino rosso")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.PRODUCT_SEARCH)
      expect(result?.params?.query).toBe("vino rosso")
    })

    it("should match 'voglio un vino'", () => {
      const result = matchAllPatterns("voglio un vino")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.PRODUCT_SEARCH)
      expect(result?.params?.query).toBe("vino")
    })
  })

  describe("Cart patterns", () => {
    it("should match 'vedi carrello'", () => {
      const result = matchAllPatterns("vedi carrello")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.CART_VIEW)
    })

    it("should match 'cosa ho nel carrello'", () => {
      const result = matchAllPatterns("cosa ho nel carrello?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.CART_VIEW)
    })

    it("should match 'svuota carrello'", () => {
      const result = matchAllPatterns("svuota carrello")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.CART_CLEAR)
    })

    it("should match 'aggiungi al carrello'", () => {
      const result = matchAllPatterns("aggiungi al carrello")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.CART_ADD)
    })
  })

  describe("Order patterns", () => {
    it("should match 'i miei ordini'", () => {
      const result = matchAllPatterns("i miei ordini")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.ORDER_LIST)
    })

    it("should match 'stato ordine ORD-12345'", () => {
      const result = matchAllPatterns("stato ordine ORD-12345")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.ORDER_STATUS)
      expect(result?.params?.orderId).toBe("ORD-12345")
    })

    it("should match 'voglio ordinare'", () => {
      const result = matchAllPatterns("voglio ordinare")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.ORDER_CREATE)
    })

    it("should match 'checkout'", () => {
      const result = matchAllPatterns("checkout")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.ORDER_CREATE)
    })
  })

  describe("Numeric selection patterns", () => {
    it("should match single number '3'", () => {
      const result = matchAllPatterns("3")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.NUMERIC_SELECTION)
      expect(result?.params?.selections).toEqual([3])
    })

    it("should match 'il numero 5'", () => {
      const result = matchAllPatterns("il numero 5")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.NUMERIC_SELECTION)
      expect(result?.params?.selections).toEqual([5])
    })

    it("should match 'prima opzione'", () => {
      const result = matchAllPatterns("prima opzione")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.NUMERIC_SELECTION)
      expect(result?.params?.selections).toEqual([1])
    })

    it("should match 'il 2 e il 4'", () => {
      const result = matchAllPatterns("il 2 e il 4")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.NUMERIC_SELECTION)
      expect(result?.params?.selections).toContain(2)
      expect(result?.params?.selections).toContain(4)
    })
  })

  describe("Greeting patterns", () => {
    it("should match 'ciao'", () => {
      const result = matchAllPatterns("ciao")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.GREETING)
    })

    it("should match 'buongiorno'", () => {
      const result = matchAllPatterns("buongiorno")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.GREETING)
    })

    it("should match 'salve'", () => {
      const result = matchAllPatterns("salve")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.GREETING)
    })
  })

  describe("Help patterns", () => {
    it("should match 'aiuto'", () => {
      const result = matchAllPatterns("aiuto")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.HELP)
    })

    it("should match 'cosa posso fare'", () => {
      const result = matchAllPatterns("cosa posso fare?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.HELP)
    })

    it("should match 'come funziona'", () => {
      const result = matchAllPatterns("come funziona?")
      expect(result).not.toBeNull()
      expect(result?.type).toBe(IntentType.HELP)
    })
  })

  describe("No match cases", () => {
    it("should return null for random text", () => {
      const result = matchAllPatterns("sdfsdfsdfsdf")
      expect(result).toBeNull()
    })

    it("should return null for complex sentences", () => {
      const result = matchAllPatterns("vorrei sapere se avete qualcosa di particolare")
      expect(result).toBeNull()
    })
  })
})

describe("IntentParser - History Parser", () => {
  describe("parseListFromMessage", () => {
    it("should detect CATEGORY_LIST", () => {
      const message = `Ecco le nostre categorie (5 items):
1. Vini Rossi
2. Vini Bianchi
3. Spumanti
4. Dolci
5. Liquori`
      const result = parseListFromMessage(message)
      expect(result).not.toBeNull()
      expect(result?.type).toBe("CATEGORY_LIST")
      expect(result?.count).toBe(5)
    })

    it("should detect PRODUCT_LIST with prices", () => {
      const message = `Ecco i prodotti:
1. Barolo DOCG - €45
2. Chianti Classico - €22
3. Brunello - €65`
      const result = parseListFromMessage(message)
      expect(result).not.toBeNull()
      expect(result?.type).toBe("PRODUCT_LIST")
    })

    it("should detect ORDER_LIST", () => {
      const message = `I tuoi ordini:
1. #ORD-12345 - In spedizione
2. #ORD-12340 - Consegnato`
      const result = parseListFromMessage(message)
      expect(result).not.toBeNull()
      expect(result?.type).toBe("ORDER_LIST")
    })

    it("should detect CART_CONTENTS", () => {
      const message = `Il tuo carrello:
• 2× Barolo DOCG - €90
• 1× Chianti - €22
Totale: €112`
      const result = parseListFromMessage(message)
      expect(result).not.toBeNull()
      expect(result?.type).toBe("CART_CONTENTS")
    })

    it("should detect GROUP_LIST", () => {
      const message = `Ho trovato gruppi di prodotti per "vino":
1. Barolo → 3 varianti
2. Chianti → 2 varianti`
      const result = parseListFromMessage(message)
      expect(result).not.toBeNull()
      expect(result?.type).toBe("GROUP_LIST")
    })

    it("should return null for non-list message", () => {
      const message = "Ciao! Come posso aiutarti?"
      const result = parseListFromMessage(message)
      expect(result).toBeNull()
    })
  })

  describe("buildContextFromHistory", () => {
    it("should extract context from last assistant message", () => {
      const history = [
        { role: "user" as const, content: "categorie" },
        {
          role: "assistant" as const,
          content: `Ecco le categorie (3 items):
1. Vini Rossi
2. Vini Bianchi
3. Spumanti`,
        },
      ]
      const context = buildContextFromHistory(history)
      expect(context).not.toBeNull()
      expect(context?.listType).toBe("CATEGORY_LIST")
    })

    it("should return null for empty history", () => {
      const context = buildContextFromHistory([])
      expect(context).toBeNull()
    })

    it("should return null if last message is from user", () => {
      const history = [
        { role: "assistant" as const, content: "Come posso aiutarti?" },
        { role: "user" as const, content: "ciao" },
      ]
      const context = buildContextFromHistory(history)
      expect(context).toBeNull()
    })
  })
})
