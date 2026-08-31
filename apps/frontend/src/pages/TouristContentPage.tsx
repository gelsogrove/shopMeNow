import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useWorkspace } from "@/hooks/use-workspace"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { touristRestaurantApi } from "@/services/touristRestaurantApi"
import { touristHotelApi } from "@/services/touristHotelApi"
import { touristExcursionApi } from "@/services/touristExcursionApi"
import { touristRefugeApi } from "@/services/touristRefugeApi"
import { touristEventApi } from "@/services/touristEventApi"
import { touristSportsFacilityApi } from "@/services/touristSportsFacilityApi"
import { touristSkiFacilityApi } from "@/services/touristSkiFacilityApi"
import { faqApi } from "@/services/faqApi"
import { flowApi } from "@/services/flowBuilderApi"
import {
  Building2,
  CableCar,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  HelpCircle,
  Home,
  Mountain,
  Search,
  Utensils,
  Workflow,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Content hub for PRO_LOCO workspaces (Andrea, 2026-08-31: "FACCIAMO UN MENU
 * CONTENT, POI DENTRO FACCIAMO DELLE CARD DI RISTORANTI ALBERGHI RIFUGI —
 * CARD CON ICONA"): one card per tourism content category, each opening its
 * own CRUD page.
 *
 * Andrea 2026-09-01 ("voglio un cerca che mi tira fuori l'elemento e mi
 * faccia capire dove e'... e possibilita di cliccare e editare"): the hub
 * also carries a global search across every category. Each result shows the
 * category it belongs to and clicking it deep-links to that item's edit form
 * (the CRUD pages open their edit sheet from an ?edit=<id> query param; flows
 * go straight to the flow editor).
 */

interface CategoryCard {
  key: string
  title: string
  description: string
  route: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
}

const CATEGORIES: CategoryCard[] = [
  {
    key: "restaurants",
    title: "Ristoranti",
    description: "Restaurants, pizzerias, agriturismi and where to eat",
    route: "/tourist-restaurants",
    icon: Utensils,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    key: "hotels",
    title: "Alberghi",
    description: "Hotels, B&Bs and places to stay",
    route: "/tourist-hotels",
    icon: Building2,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    key: "excursions",
    title: "Escursioni",
    description: "Trails, walks and hiking routes",
    route: "/tourist-excursions",
    icon: Mountain,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  {
    key: "refuges",
    title: "Rifugi",
    description: "Mountain refuges, malghe and bivouacs",
    route: "/tourist-refuges",
    icon: Home,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  {
    key: "events",
    title: "Eventi",
    description: "Festivals, traditions and local events",
    route: "/tourist-events",
    icon: CalendarDays,
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  // Andrea 2026-09-01 ("con la stessa struttura voglio poter aggiungere
  // strutture sportive... e poi anche impianti di sci"): two more categories,
  // same shape as the original five.
  {
    key: "sportsFacilities",
    title: "Strutture sportive",
    description: "Sports facilities like golf, tennis and gyms",
    route: "/tourist-sports-facilities",
    icon: Dumbbell,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
  },
  {
    key: "skiFacilities",
    title: "Impianti di sci",
    description: "Ski lifts and slopes with their difficulty",
    route: "/tourist-ski-facilities",
    icon: CableCar,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
  },
  // Andrea 2026-08-31 ("FAQ METTILO DENTRO CONTENT"): for PRO_LOCO the FAQs
  // entry moved from the Settings dropdown into this hub as one more card.
  {
    key: "faqs",
    title: "FAQs",
    description: "Quick answers always included in the chatbot's prompt",
    route: "/faq",
    icon: HelpCircle,
    iconBg: "bg-yellow-100",
    iconColor: "text-amber-500",
  },
  // Andrea 2026-09-01 ("mi piacerebbe mettere qui dentro anche flow"): same
  // treatment as FAQs — for PRO_LOCO the Flows entry moved from the Settings
  // dropdown into this hub as one more card.
  {
    key: "flows",
    title: "Flows",
    description: "Visual flow-builder for this chatbot's diagnostic conversations",
    route: "/settings/demorobot",
    icon: Workflow,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
]

// One searchable entry across all categories. `editPath` is where clicking
// the result lands: the item's edit form, not just the category list.
interface SearchItem {
  id: string
  label: string
  snippet?: string
  categoryKey: string
  editPath: string
}

const MAX_SEARCH_RESULTS = 30

export function TouristContentPage() {
  const navigate = useNavigate()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [searchItems, setSearchItems] = useState<SearchItem[]>([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    const loadContent = async () => {
      if (!workspace?.id) return
      try {
        const [restaurants, hotels, excursions, refuges, events, sportsFacilities, skiFacilities, faqs, flows] = await Promise.all([
          touristRestaurantApi.getTouristRestaurants(workspace.id),
          touristHotelApi.getTouristHotels(workspace.id),
          touristExcursionApi.getTouristExcursions(workspace.id),
          touristRefugeApi.getTouristRefuges(workspace.id),
          touristEventApi.getTouristEvents(workspace.id),
          touristSportsFacilityApi.getTouristSportsFacilities(workspace.id),
          touristSkiFacilityApi.getTouristSkiFacilities(workspace.id),
          faqApi.getFAQs(workspace.id),
          flowApi.listAll(workspace.id),
        ])
        setCounts({
          restaurants: restaurants.length,
          hotels: hotels.length,
          excursions: excursions.length,
          refuges: refuges.length,
          events: events.length,
          sportsFacilities: sportsFacilities.length,
          skiFacilities: skiFacilities.length,
          faqs: faqs.length,
          flows: flows.length,
        })
        setSearchItems([
          ...restaurants.map((r) => ({
            id: r.id,
            label: r.name,
            snippet: r.description ?? undefined,
            categoryKey: "restaurants",
            editPath: `/tourist-restaurants?edit=${r.id}`,
          })),
          ...hotels.map((h) => ({
            id: h.id,
            label: h.name,
            snippet: h.description ?? undefined,
            categoryKey: "hotels",
            editPath: `/tourist-hotels?edit=${h.id}`,
          })),
          ...excursions.map((x) => ({
            id: x.id,
            label: x.name,
            snippet: x.description ?? undefined,
            categoryKey: "excursions",
            editPath: `/tourist-excursions?edit=${x.id}`,
          })),
          ...refuges.map((rf) => ({
            id: rf.id,
            label: rf.name,
            snippet: rf.description ?? undefined,
            categoryKey: "refuges",
            editPath: `/tourist-refuges?edit=${rf.id}`,
          })),
          ...events.map((ev) => ({
            id: ev.id,
            label: ev.title,
            snippet: ev.description ?? undefined,
            categoryKey: "events",
            editPath: `/tourist-events?edit=${ev.id}`,
          })),
          ...sportsFacilities.map((sf) => ({
            id: sf.id,
            label: sf.name,
            snippet: sf.description ?? sf.sport ?? undefined,
            categoryKey: "sportsFacilities",
            editPath: `/tourist-sports-facilities?edit=${sf.id}`,
          })),
          ...skiFacilities.map((sk) => ({
            id: sk.id,
            label: sk.name,
            snippet: sk.description ?? sk.slopeType ?? undefined,
            categoryKey: "skiFacilities",
            editPath: `/tourist-ski-facilities?edit=${sk.id}`,
          })),
          ...faqs.map((f) => ({
            id: f.id,
            label: f.question,
            snippet: f.answer,
            categoryKey: "faqs",
            editPath: `/faq?edit=${f.id}`,
          })),
          // Flows have a full-page editor, so the result links straight to it
          // ("generic" is the URL segment for category-less flows, see
          // FlowsPage).
          ...flows.map((fl) => ({
            id: fl.id,
            label: fl.title,
            categoryKey: "flows",
            editPath: `/settings/demorobot/${fl.flowCategoryId ?? "generic"}/flows/${fl.id}/edit`,
          })),
        ])
      } catch (error) {
        logger.error("Error loading tourist content:", error)
      }
    }
    if (!isLoadingWorkspace) loadContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return searchItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.snippet ?? "").toLowerCase().includes(q)
      )
      .slice(0, MAX_SEARCH_RESULTS)
  }, [query, searchItems])

  if (!workspace?.id) {
    return (
      <PageLayout>
        <div>No workspace selected</div>
      </PageLayout>
    )
  }

  const isSearching = query.trim().length > 0

  return (
    <PageLayout>
      <div className="space-y-6">
        <SettingsPageHeader currentSection="tourist-content" />

        <div>
          <h2 className="text-xl font-semibold text-gray-900">Content</h2>
          <p className="text-sm text-gray-500 mt-1">
            The tourism content the chatbot uses to answer customers. Each
            category has its own cards with photos, details and links.
          </p>
        </div>

        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all content (restaurants, hotels, events, FAQs, flows...)"
            className="pl-9"
          />
        </div>

        {isSearching && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              {results.length === 0
                ? "No content matches your search."
                : `${results.length} result${results.length === 1 ? "" : "s"}`}
            </p>
            {results.map((item) => {
              const category = CATEGORIES.find((c) => c.key === item.categoryKey)
              const Icon = category?.icon ?? Search
              return (
                <Card
                  key={`${item.categoryKey}-${item.id}`}
                  className="p-4 cursor-pointer hover:shadow-md hover:border-green-300 transition-all group"
                  onClick={() => navigate(item.editPath)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${category?.iconBg ?? "bg-gray-100"} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${category?.iconColor ?? "text-gray-500"}`} />
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {item.label}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${category?.iconBg ?? "bg-gray-100"} ${category?.iconColor ?? "text-gray-500"} flex-shrink-0`}
                        >
                          {category?.title ?? item.categoryKey}
                        </span>
                      </div>
                      {item.snippet && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.snippet}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition-colors flex-shrink-0" />
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {!isSearching && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((category) => {
              const Icon = category.icon
              const count = counts[category.key]
              return (
                <Card
                  key={category.key}
                  className="p-6 cursor-pointer hover:shadow-md hover:border-green-300 transition-all group"
                  onClick={() => navigate(category.route)}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl ${category.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${category.iconColor}`} />
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-600 transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mt-4">
                    {category.title}
                    {count !== undefined && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({count})
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
