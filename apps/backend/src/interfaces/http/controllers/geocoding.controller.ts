import { Request, Response } from "express"
import logger from "../../../utils/logger"

/**
 * Proxies place search to Nominatim (OpenStreetMap) for the tourist content
 * forms' location picker — free, no API key (Andrea, 2026-09-01: "senza api
 * di google.senza spendere troppi soldi"). Saved value is still plain text
 * (display_name), never coordinates: the chatbot builds its Google Maps link
 * from that text at answer time, same as a hand-typed address.
 *
 * A browser can't set a custom User-Agent (the header is browser-reserved),
 * and Nominatim's usage policy requires one identifying the application —
 * https://operations.osmfoundation.org/policies/nominatim/ — so this proxy
 * exists to set it server-side, plus keep the public server behind our own
 * auth instead of exposing it to anonymous traffic.
 */
export class GeocodingController {
  // In-memory, process-lifetime cache — the policy requires caching results,
  // and repeat searches (someone re-editing the same place) are common in a
  // backoffice form. Not persisted: a proxy restart cache-misses once, which
  // is fine at this volume.
  private cache = new Map<string, { at: number; results: unknown }>()
  private readonly TTL_MS = 24 * 60 * 60 * 1000

  async search(req: Request, res: Response): Promise<void> {
    try {
      const q = String(req.query.q ?? "").trim()
      if (!q) {
        res.status(400).json({ error: "Query parameter 'q' is required" })
        return
      }

      const cached = this.cache.get(q)
      if (cached && Date.now() - cached.at < this.TTL_MS) {
        res.json(cached.results)
        return
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
      const response = await fetch(url, {
        headers: {
          // Required by Nominatim's usage policy — identifies the calling
          // application, not the visitor's browser.
          "User-Agent": "eChatbot-Backoffice/1.0 (https://www.echatbot.ai)",
        },
      })

      if (!response.ok) {
        logger.error(`Nominatim search failed: ${response.status} ${response.statusText}`)
        res.status(502).json({ error: "Location search is temporarily unavailable" })
        return
      }

      const results = await response.json()
      this.cache.set(q, { at: Date.now(), results })
      res.json(results)
    } catch (error) {
      logger.error("Error in geocoding search:", error)
      res.status(500).json({ error: "Location search failed" })
    }
  }
}
