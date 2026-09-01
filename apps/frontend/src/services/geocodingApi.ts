import { logger } from "@/lib/logger"
import { api } from "./api"

export interface GeocodingResult {
  display_name: string
  lat: string
  lon: string
}

// Backed by Nominatim/OpenStreetMap via our own proxy (no Google Places API
// key — Andrea, 2026-09-01). Only display_name is ever saved by the caller;
// lat/lon ride along for a future map preview but are not persisted today.
export const searchPlaces = async (query: string): Promise<GeocodingResult[]> => {
  try {
    const response = await api.get("/geocoding/search", { params: { q: query } })
    return response.data
  } catch (error) {
    logger.error("Error searching places:", error)
    throw error
  }
}
