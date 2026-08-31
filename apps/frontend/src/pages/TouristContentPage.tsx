import { PageLayout } from "@/components/layout/PageLayout"
import { logger } from "@/lib/logger"
import { Card } from "@/components/ui/card"
import { useWorkspace } from "@/hooks/use-workspace"
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { touristRestaurantApi } from "@/services/touristRestaurantApi"
import { touristHotelApi } from "@/services/touristHotelApi"
import { touristExcursionApi } from "@/services/touristExcursionApi"
import { touristRefugeApi } from "@/services/touristRefugeApi"
import { touristApartmentApi } from "@/services/touristApartmentApi"
import { touristEventApi } from "@/services/touristEventApi"
import { faqApi } from "@/services/faqApi"
import {
  Building2,
  CalendarDays,
  ChevronRight,
  HelpCircle,
  Home,
  KeyRound,
  Mountain,
  Utensils,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Content hub for PRO_LOCO workspaces (Andrea, 2026-08-31: "FACCIAMO UN MENU
 * CONTENT, POI DENTRO FACCIAMO DELLE CARD DI RISTORANTI ALBERGHI RIFUGI —
 * CARD CON ICONA"): one card per tourism content category, each opening its
 * own CRUD page.
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
    key: "apartments",
    title: "Case e appartamenti",
    description: "Vacation houses, apartments, residences and rental agencies",
    route: "/tourist-apartments",
    icon: KeyRound,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
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
]

export function TouristContentPage() {
  const navigate = useNavigate()
  const { workspace, loading: isLoadingWorkspace } = useWorkspace()
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const loadCounts = async () => {
      if (!workspace?.id) return
      try {
        const [restaurants, hotels, excursions, refuges, apartments, events, faqs] = await Promise.all([
          touristRestaurantApi.getTouristRestaurants(workspace.id),
          touristHotelApi.getTouristHotels(workspace.id),
          touristExcursionApi.getTouristExcursions(workspace.id),
          touristRefugeApi.getTouristRefuges(workspace.id),
          touristApartmentApi.getTouristApartments(workspace.id),
          touristEventApi.getTouristEvents(workspace.id),
          faqApi.getFAQs(workspace.id),
        ])
        setCounts({
          restaurants: restaurants.length,
          hotels: hotels.length,
          excursions: excursions.length,
          refuges: refuges.length,
          apartments: apartments.length,
          events: events.length,
          faqs: faqs.length,
        })
      } catch (error) {
        logger.error("Error loading tourist content counts:", error)
      }
    }
    if (!isLoadingWorkspace) loadCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, isLoadingWorkspace])

  if (!workspace?.id) {
    return (
      <PageLayout>
        <div>No workspace selected</div>
      </PageLayout>
    )
  }

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
      </div>
    </PageLayout>
  )
}
