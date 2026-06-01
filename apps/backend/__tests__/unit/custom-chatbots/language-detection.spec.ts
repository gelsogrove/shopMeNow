/**
 * Unit Tests: Custom Chatbot Language Detection (demowash + ecolaundry)
 *
 * 🚨 BUG FIXED (2026-05-28): Bot was replying in Spanish to Catalan messages.
 * Root cause analyzed with Andrea — TWO bugs in `state.ts`:
 *
 *   1. Tie-break favored 'es' silently. On "Hola" (matches both es and ca),
 *      the old loop used `>` strict and iterated object keys in insertion
 *      order → es always won by ordering, not by merit.
 *
 *   2. Once `state.language` was set, `seedLanguageIfNeeded` returned
 *      immediately without ever re-evaluating. So a Spanish lock on
 *      turn 1 ("Hola") would persist even when turn 2 was pure Catalan
 *      ("no veig el sabó a la rentadora").
 *
 * The fix introduces `updateLanguageOnTurn` with the following policy
 * (agreed with Andrea):
 *   - Default language = 'es' (business operates in Spain).
 *   - Re-evaluate every turn (no permanent lock).
 *   - Sticky on 0-match: keep current if message has no markers.
 *   - Tie-break: current language wins if tied; else 'es' wins.
 *
 * The 6 dictionaries (it/es/en/ca/pt/fr) are Andrea's spec.
 *
 * IMPORTANT: demowash and ecolaundry state.ts must remain byte-identical.
 * We test both to make sure the fix is mirrored in both files.
 *
 * Iron Rule #5: each detector ships with tests — this file IS that test.
 * Iron Rule #8: multi-language by design — every detector covers all 6 langs.
 */

// NOTE: custom-demowash no longer uses a regex language detector — language is
// now decided by the LLM via a ⟦LANG:xx⟧ reply trailer (see custom-demowash
// architecture.md §8.1). Its scoreLanguages/detectLanguageHeuristic/
// updateLanguageOnTurn functions were removed, so the demowash arm of this
// parameterized suite was dropped. custom-ecolaundry still ships the regex
// detector and is still covered below.
import {
  detectLanguageHeuristic as detectEcolaundry,
  resetState as resetEcolaundry,
  scoreLanguages as scoreEcolaundry,
  seedLanguageIfNeeded as seedEcolaundry,
  updateLanguageOnTurn as updateEcolaundry,
} from "../../../custom-ecolaundry/state"

// Only custom-ecolaundry still uses the regex detector. (custom-demowash was
// migrated to LLM-owned language detection — see the import note above.)
const MODULES = [
  {
    name: "custom-ecolaundry",
    detect: detectEcolaundry,
    update: updateEcolaundry,
    seed: seedEcolaundry,
    score: scoreEcolaundry,
    reset: resetEcolaundry,
  },
] as const

describe.each(MODULES)(
  "$name — language detection",
  ({ detect, update, seed, score, reset }) => {
    let sessionId: string

    beforeEach(() => {
      // Each test gets a fresh session id — we use the module-name-suffixed
      // id so the two modules don't share state (they're separate Map
      // instances anyway, but this makes intent explicit).
      sessionId = `test-session-${Math.random().toString(36).slice(2)}`
    })

    afterEach(() => {
      reset(sessionId)
    })

    // ── detectLanguageHeuristic (stateless) ──────────────────────────────────

    describe("detectLanguageHeuristic — stateless scoring", () => {
      it("returns null on empty string", () => {
        expect(detect("")).toBeNull()
        expect(detect("   ")).toBeNull()
      })

      it("returns null when no marker word is present", () => {
        // No words from any dictionary
        expect(detect("👍👍👍")).toBeNull()
        expect(detect("xyzzy zorgblat")).toBeNull()
      })

      it("detects Italian on a clear Italian sentence", () => {
        expect(detect("la lavatrice non funziona, perché?")).toBe("it")
      })

      it("detects Spanish on a clear Spanish sentence", () => {
        expect(detect("la lavadora no funciona, ¿cómo lo soluciono?")).toBe(
          "es"
        )
      })

      it("detects English on a clear English sentence", () => {
        expect(detect("the washing machine is not working today")).toBe("en")
      })

      it("detects Catalan on the exact bug-report message", () => {
        // This is the message that triggered the bug investigation.
        // "rentadora" + "sabó" + "no" → ca should win.
        expect(detect("no veig el sabó a la rentadora")).toBe("ca")
      })

      it("detects Portuguese on a clear Portuguese sentence", () => {
        expect(detect("olá, a máquina não está funcionando hoje")).toBe("pt")
      })

      it("detects French on a clear French sentence", () => {
        expect(detect("bonjour, la machine ne fonctionne pas aujourd'hui")).toBe(
          "fr"
        )
      })
    })

    // ── scoreLanguages ───────────────────────────────────────────────────────

    describe("scoreLanguages — exposed for transparency", () => {
      it("returns zero for all languages on empty input", () => {
        const s = score("")
        expect(s).toEqual({ es: 0, it: 0, en: 0, ca: 0, fr: 0, pt: 0, de: 0, ar: 0, zh: 0, da: 0, el: 0, fi: 0, pl: 0, tr: 0, uk: 0 })
      })

      it("on the Catalan bug-report message, ca beats es", () => {
        // Sanity check on the score itself — this is the heart of the fix.
        const s = score("no veig el sabó a la rentadora")
        expect(s.ca).toBeGreaterThan(s.es)
      })
    })

    // ── updateLanguageOnTurn — sticky + re-detect policy ─────────────────────

    describe("updateLanguageOnTurn — per-turn policy", () => {
      it("defaults to 'es' when state is empty and message has no markers", () => {
        // No language set, message is non-linguistic (emoji)
        expect(update(sessionId, "👍")).toBe("es")
      })

      it("sets language to 'es' on Spanish first message", () => {
        expect(update(sessionId, "hola, ¿cómo estás?")).toBe("es")
      })

      it("THE BUG FIX: Hola → es by default, then Catalan content switches to ca", () => {
        // This is the exact screenshot scenario from the bug report.
        // Turn 1: "Hola" matches BOTH es and ca markers (score 1 each).
        //   Tie-break with no current language → default to 'es'.
        //   This is the "if business is in Spain, treat 'Hola' as Spanish
        //   until proven otherwise" policy Andrea asked for.
        expect(update(sessionId, "Hola")).toBe("es")

        // Turn 2: "no veig el sabó a la rentadora" — clearly Catalan.
        //   ca markers hit: no, sabó, rentadora → score ca >> es.
        //   Re-detection (which was missing before the fix) MUST switch
        //   from es to ca. This was the broken behavior in the screenshot.
        expect(update(sessionId, "no veig el sabó a la rentadora")).toBe("ca")
      })

      it("re-detection: starts in Spanish, switches to Catalan when content is clearly catalan", () => {
        // This is the more general bug-fix proof: if turn 1 settles on
        // Spanish for any reason, turn 2 with clear Catalan content must
        // switch — the old code locked permanently after turn 1.
        update(sessionId, "la lavadora no funciona")
        // sanity: confirm state is es
        // (we don't expose state here, so we infer via behavior:
        //  send a tie message like "no" and it should stay es by sticky)
        expect(update(sessionId, "no veig el sabó a la rentadora")).toBe("ca")
      })

      it("sticky on 0-match: 'ok' after Catalan keeps ca (no reset to es)", () => {
        // First set the language to Catalan
        update(sessionId, "no veig el sabó a la rentadora")
        // Then send a message with NO markers — must NOT flip back to es
        expect(update(sessionId, "ok")).toBe("ca")
        expect(update(sessionId, "👍")).toBe("ca")
      })

      it("sticky on tie: if current ties with another lang, current wins", () => {
        // First lock the session to Spanish via a clear Spanish message
        update(sessionId, "la lavadora no funciona")
        // Now send "no" — appears in BOTH es and ca markers (true tie).
        // The tie-break must KEEP es (current sticky), not flip to ca.
        expect(update(sessionId, "no")).toBe("es")
      })

      it("sticky on tie (mirror): current=ca, tie message keeps ca", () => {
        // Same logic from the other side: lock to ca first.
        update(sessionId, "rentadora sabó")
        // "no" ties es/ca — sticky must keep current (ca).
        expect(update(sessionId, "no")).toBe("ca")
      })

      it("re-detects: from es, a clearly Italian message switches to it", () => {
        update(sessionId, "hola, ¿cómo?")
        expect(update(sessionId, "la lavatrice non funziona perché")).toBe("it")
      })

      it("re-detects: from ca, a clearly English message switches to en", () => {
        update(sessionId, "rentadora sabó")
        expect(update(sessionId, "the washing machine is not working")).toBe(
          "en"
        )
      })

      it("defaults to 'es' on tie with no current language and es is among top", () => {
        // "no" matches both es and ca with score 1. No state set yet.
        // Default policy: pick 'es' (business operates in Spain).
        expect(update(sessionId, "no")).toBe("es")
      })

      it("returns first by LANG_ORDER on tie when es not among top and no current", () => {
        // "rentadora máquina" → ca:1, pt:1. No state, no es in tie.
        // LANG_ORDER puts 'it' before 'ca' before 'pt'; only ca and pt
        // are tied, so the first one in LANG_ORDER among them is ca.
        expect(update(sessionId, "rentadora máquina")).toBe("ca")
      })
    })

    // ── All 6 languages reachable (Iron Rule #8) ─────────────────────────────

    describe("multi-language by design — all 6 languages reachable", () => {
      // For each language, a fresh session with a clear sample message
      // must end up locked on that language. Iron Rule #8.
      const samples: Record<string, string> = {
        es: "la lavadora no funciona, ¿qué hago hoy?",
        it: "la lavatrice non funziona oggi, cosa devo fare?",
        en: "the washing machine is not working today, what do I do",
        ca: "la rentadora no funciona avui, què faig amb el sabó?",
        pt: "a máquina não está funcionando hoje, o que faço?",
        fr: "la machine ne fonctionne pas aujourd'hui, qu'est-ce que je fais",
      }
      for (const [expected, msg] of Object.entries(samples)) {
        it(`reaches ${expected}`, () => {
          const sid = `lang-test-${expected}-${Math.random()}`
          expect(update(sid, msg)).toBe(expected)
          reset(sid)
        })
      }
    })

    // ── Backward-compat: seedLanguageIfNeeded still works ────────────────────

    describe("seedLanguageIfNeeded — backward-compat alias", () => {
      it("delegates to updateLanguageOnTurn (alias kept for agent.ts:814)", () => {
        // The new signature returns Lang (not Lang|null) — this is a
        // narrowing change. agent.ts only reads the in-state value
        // afterwards, so the return type change is safe.
        // "no" is a true es/ca tie → default policy resolves to 'es'.
        const result = seed(sessionId, "no")
        expect(result).toBe("es")
      })

      it("respects sticky-on-0-match through the alias", () => {
        seed(sessionId, "no veig el sabó a la rentadora")
        expect(seed(sessionId, "ok")).toBe("ca")
      })
    })
  }
)
