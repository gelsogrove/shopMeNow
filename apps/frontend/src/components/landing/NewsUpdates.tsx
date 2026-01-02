import { useLanguage } from "@/contexts/LanguageContext"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Headphones,
  MessageCircle,
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
  {
    id: 5,
    dateKey: "news.5.date",
    titleKey: "news.5.title",
    categoryKey: "news.5.category",
    descriptionKey: "news.5.desc",
    icon: <MessageCircle className="w-6 h-6" />,
    image: "/logo.png",
    bgGradient: "from-emerald-50 to-teal-50",
  },
  {
    id: 6,
    dateKey: "news.6.date",
    titleKey: "news.6.title",
    categoryKey: "news.6.category",
    descriptionKey: "news.6.desc",
    icon: <Headphones className="w-6 h-6" />,
    image: "/logo.png",
    bgGradient: "from-amber-50 to-orange-50",
  },
]

export function NewsUpdates() {
  const { t } = useLanguage()
  const [currentIndex, setCurrentIndex] = useState(1)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isMobileView, setIsMobileView] = useState(false)

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe) {
      goToNext()
    }
    if (isRightSwipe) {
      goToPrevious()
    }
  }

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
      }, 500) // Wait for transition to complete

      setTimeout(() => {
        setIsTransitioning(true)
      }, 550) // Re-enable transition
    } else if (currentIndex === -1) {
      // Just moved to before first item
      setTimeout(() => {
        setIsTransitioning(false)
        setCurrentIndex(newsItems.length - 1)
      }, 500)

      setTimeout(() => {
        setIsTransitioning(true)
      }, 550)
    }
  }, [currentIndex])

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setIsMobileView(false)
      return
    }
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateMatch = () => setIsMobileView(mediaQuery.matches)
    updateMatch()
    mediaQuery.addEventListener("change", updateMatch)
    return () => mediaQuery.removeEventListener("change", updateMatch)
  }, [])

  // Create array with duplicates for infinite scroll
  const extendedItems = [...newsItems, ...newsItems, ...newsItems]
  const actualIndex = currentIndex + newsItems.length

  return (
    <div className="pt-20 pb-24 bg-gradient-to-br from-emerald-50 via-green-50/30 to-teal-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(5,150,105,0.06),transparent_50%)]" />
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Latest Updates and Features
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Stay updated with our newest features and improvements
          </p>
        </div>

        {/* Carousel Container */}
        <div 
          className="relative flex items-center justify-center"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Cards Container */}
          <div className="flex items-center justify-center w-full px-2 sm:px-4 md:px-8 lg:px-12 overflow-visible md:overflow-hidden">
            <div className="relative w-full max-w-5xl h-[560px] sm:h-[520px] md:h-[420px] flex items-center justify-center">
              {extendedItems.map((item, idx) => {
                const offset = idx - actualIndex
                const isCenter = offset === 0
                const isVisible = Math.abs(offset) <= 1
                const translatePercent = isMobileView ? 85 : 100

                if (!isVisible) return null

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="absolute"
                    style={{
                      transform: `translateX(${offset * translatePercent}%) scale(${
                        isCenter ? 1 : 0.75
                      })`,
                      opacity: isCenter ? 1 : 0.4,
                      zIndex: isCenter ? 10 : 1,
                      transition: isTransitioning
                        ? "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                        : "none",
                    }}
                  >
                    {/* Card wrapper with rotated frame effect */}
                    <div className="relative group">
                      {/* Decorative rotated background frame - only for center card */}
                      {isCenter && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl rotate-2 scale-105 shadow-lg group-hover:rotate-3 transition-transform duration-500"></div>
                          {/* Glow effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                        </>
                      )}
                      
                      <div
                        className={`relative bg-white rounded-3xl shadow-xl border-2 overflow-hidden transition-all duration-500 ${
                          isCenter
                            ? "border-green-500 w-[90vw] md:w-[620px] ring-4 ring-green-100 hover:ring-green-200 hover:shadow-2xl hover:scale-[1.02]"
                            : "border-gray-200 bg-gray-50/50 w-[75vw] md:w-[500px] hover:border-gray-300 hover:shadow-lg"
                        }`}
                      >
                        <div className="p-6 md:p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div
                              className={`p-3 rounded-xl transition-all ${
                                isCenter
                                  ? "bg-green-100 text-green-600 ring-2 ring-green-200"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {item.icon}
                            </div>
                            <span
                              className={`px-4 py-1.5 text-sm rounded-full font-semibold transition-all ${
                                isCenter
                                  ? "bg-green-600 text-white shadow-md"
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
                            className={`text-2xl md:text-3xl font-bold mb-4 transition-colors tracking-tight ${
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
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Indicators - Più grandi e visibili */}
        <div className="flex justify-center gap-3 mt-8">
          {newsItems.map((_, index) => {
            const normalizedIndex =
              ((currentIndex % newsItems.length) + newsItems.length) %
              newsItems.length
            return (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-3 rounded-full transition-all duration-500 ${
                  index === normalizedIndex
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 w-12 shadow-lg hover:shadow-xl scale-110"
                    : "bg-gray-300 hover:bg-gradient-to-r hover:from-gray-400 hover:to-gray-500 w-3 hover:w-8 hover:scale-105"
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
