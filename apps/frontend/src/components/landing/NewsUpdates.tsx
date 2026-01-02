import { useLanguage } from "@/contexts/LanguageContext"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Headphones,
  Megaphone,
  TrendingUp,
} from "lucide-react"
import { useEffect, useState } from "react"

interface NewsItem {
  id: number
  dateKey: string
  titleKey: string
  categoryKey: string
  descriptionKey: string
  icon: React.ReactNode
  image: string
  bgGradient: string
}

const newsItems: NewsItem[] = [
  {
    id: 1,
    dateKey: "news.1.date",
    titleKey: "news.1.title",
    categoryKey: "news.1.category",
    descriptionKey: "news.1.desc",
    icon: <Globe2 className="w-6 h-6" />,
    image: "/logo.png",
    bgGradient: "from-green-50 to-blue-50",
  },
  {
    id: 2,
    dateKey: "news.2.date",
    titleKey: "news.2.title",
    categoryKey: "news.2.category",
    descriptionKey: "news.2.desc",
    icon: <TrendingUp className="w-6 h-6" />,
    image: "/logo.png",
    bgGradient: "from-purple-50 to-pink-50",
  },
  {
    id: 3,
    dateKey: "news.3.date",
    titleKey: "news.3.title",
    categoryKey: "news.3.category",
    descriptionKey: "news.3.desc",
    icon: <Headphones className="w-6 h-6" />,
    image: "/logo.png",
    bgGradient: "from-blue-50 to-cyan-50",
  },
  {
    id: 4,
    dateKey: "news.4.date",
    titleKey: "news.4.title",
    categoryKey: "news.4.category",
    descriptionKey: "news.4.desc",
    icon: <Megaphone className="w-6 h-6" />,
    image: "/logo.png",
    bgGradient: "from-orange-50 to-yellow-50",
  },
]

export function NewsUpdates() {
  const { t } = useLanguage()
  const [currentIndex, setCurrentIndex] = useState(1)
  const [isTransitioning, setIsTransitioning] = useState(true)

  const goToPrevious = () => {
    setCurrentIndex((prev) => prev - 1)
  }

  const goToNext = () => {
    setCurrentIndex((prev) => prev + 1)
  }

  // Handle infinite loop - reset position without animation
  useEffect(() => {
    if (currentIndex === newsItems.length) {
      // Just moved to duplicate of first item
      setTimeout(() => {
        setIsTransitioning(false)
        setCurrentIndex(0)
      }, 700) // Wait for transition to complete

      setTimeout(() => {
        setIsTransitioning(true)
      }, 750) // Re-enable transition
    } else if (currentIndex === -1) {
      // Just moved to before first item
      setTimeout(() => {
        setIsTransitioning(false)
        setCurrentIndex(newsItems.length - 1)
      }, 700)

      setTimeout(() => {
        setIsTransitioning(true)
      }, 750)
    }
  }, [currentIndex])

  // Create array with duplicates for infinite scroll
  const extendedItems = [...newsItems, ...newsItems, ...newsItems]
  const actualIndex = currentIndex + newsItems.length

  return (
    <div className="py-16 bg-gradient-to-br from-slate-50 to-blue-50 -mt-[35px]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-base font-semibold uppercase tracking-[0.25em] text-green-600">
            <span className="inline-block align-middle h-[1px] w-6 bg-green-600 mr-2" aria-hidden="true" />
            {t("news.title")}
            <span className="inline-block align-middle h-[1px] w-6 bg-green-600 ml-2" aria-hidden="true" />
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative flex items-center justify-center">
          {/* Left Arrow */}
          <button
            onClick={goToPrevious}
            className="absolute -left-2 md:left-8 z-20 bg-white hover:bg-green-50 text-gray-800 rounded-full p-2 md:p-4 shadow-xl hover:shadow-2xl transition-all hover:scale-110 border-2 border-gray-200 hover:border-green-500"
            aria-label="Previous update"
          >
            <ChevronLeft className="w-6 h-6 md:w-10 md:h-10" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={goToNext}
            className="absolute -right-2 md:right-8 z-20 bg-white hover:bg-green-50 text-gray-800 rounded-full p-2 md:p-4 shadow-xl hover:shadow-2xl transition-all hover:scale-110 border-2 border-gray-200 hover:border-green-500"
            aria-label="Next update"
          >
            <ChevronRight className="w-6 h-6 md:w-10 md:h-10" />
          </button>

          {/* Cards Container */}
          <div className="flex items-center justify-center w-full px-16 md:px-24 overflow-hidden">
            <div className="relative w-full max-w-4xl h-[450px] flex items-center justify-center">
              {extendedItems.map((item, idx) => {
                const offset = idx - actualIndex
                const isCenter = offset === 0
                const isVisible = Math.abs(offset) <= 1

                if (!isVisible) return null

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="absolute"
                    style={{
                      transform: `translateX(${offset * 110}%) scale(${
                        isCenter ? 1 : 0.75
                      })`,
                      opacity: isCenter ? 1 : 0.4,
                      zIndex: isCenter ? 10 : 1,
                      transition: isTransitioning
                        ? "all 0.7s ease-in-out"
                        : "none",
                    }}
                  >
                    <div
                      className={`bg-white rounded-2xl shadow-xl border-2 overflow-hidden ${
                        isCenter
                          ? "border-green-500 w-[90vw] md:w-[600px]"
                          : "border-gray-300 bg-gray-50 w-[75vw] md:w-[500px]"
                      }`}
                    >
                      <div className="p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6">
                          <div
                            className={`p-3 rounded-lg transition-colors ${
                              isCenter
                                ? "bg-green-100 text-green-600"
                                : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {item.icon}
                          </div>
                          <span
                            className={`px-3 py-1 text-sm rounded-full font-medium transition-colors ${
                              isCenter
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {t(item.categoryKey)}
                          </span>
                          <Calendar
                            className={`w-4 h-4 ml-auto transition-colors ${
                              isCenter ? "text-gray-400" : "text-gray-300"
                            }`}
                          />
                          <span
                            className={`text-sm transition-colors ${
                              isCenter ? "text-gray-500" : "text-gray-400"
                            }`}
                          >
                            {t(item.dateKey)}
                          </span>
                        </div>

                        <h3
                          className={`text-2xl md:text-3xl font-bold mb-4 transition-colors ${
                            isCenter ? "text-gray-900" : "text-gray-600"
                          }`}
                        >
                          {t(item.titleKey)}
                        </h3>

                        <p
                          className={`text-base md:text-lg leading-relaxed transition-colors ${
                            isCenter ? "text-gray-700" : "text-gray-500"
                          }`}
                        >
                          {t(item.descriptionKey)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Indicators - Separate Row */}
        <div className="flex justify-center gap-2 mt-4">
          {newsItems.map((_, index) => {
            const normalizedIndex =
              ((currentIndex % newsItems.length) + newsItems.length) %
              newsItems.length
            return (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === normalizedIndex
                    ? "bg-green-500 scale-150"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-label={`Go to update ${index + 1}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
