import { Icons } from "./icons"

export function ShopIllustration() {
  return (
    <div className="relative w-full h-full min-h-[500px] flex items-center justify-center p-8">
      {/* Street Background */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-green-100/30 backdrop-blur-sm" />

      {/* Main Scene */}
      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Main Hotel */}
        <div className="absolute left-4 bottom-24 flex flex-col items-center">
          <div className="relative">
            <Icons.hotel className="w-48 h-48 text-green-600" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Icons.bed className="w-20 h-20 text-green-500" />
            </div>
            {/* Hotel Sign */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
              HOTEL
            </div>
          </div>
        </div>

        {/* Shopping Strip */}
        <div className="absolute right-4 bottom-24 flex gap-4">
          {/* Clothing Store */}
          <div className="relative flex flex-col items-center">
            <Icons.building className="w-32 h-32 text-green-600" />
            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Icons.clothes className="w-12 h-12 text-green-500" />
            </div>
            <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Icons.bag className="w-8 h-8 text-green-500" />
            </div>
          </div>

          {/* Cafe */}
          <div className="relative flex flex-col items-center mt-8">
            <Icons.building className="w-28 h-28 text-green-600" />
            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Icons.coffee className="w-10 h-10 text-green-500" />
            </div>
            <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Icons.restaurant className="w-8 h-8 text-green-500" />
            </div>
          </div>

          {/* Shopping Center */}
          <div className="relative flex flex-col items-center">
            <Icons.building className="w-36 h-36 text-green-600" />
            <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Icons.store className="w-14 h-14 text-green-500" />
            </div>
            <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Icons.basket className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0">
          {/* Shopping Elements */}
          <div className="absolute top-1/4 right-1/3">
            <Icons.bag
              className="w-8 h-8 text-green-500 animate-float"
              style={{ animationDelay: "0.5s" }}
            />
          </div>
          <div className="absolute top-1/3 left-1/3">
            <Icons.coffee
              className="w-8 h-8 text-green-600 animate-float"
              style={{ animationDelay: "1.2s" }}
            />
          </div>
          <div className="absolute bottom-1/3 right-1/4">
            <Icons.clothes
              className="w-8 h-8 text-green-500 animate-float"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
          <div className="absolute top-1/2 right-1/2">
            <Icons.creditCard
              className="w-8 h-8 text-green-600 animate-float"
              style={{ animationDelay: "1.5s" }}
            />
          </div>
        </div>
      </div>

      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid Pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-green-600"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Decorative Circles */}
        <div className="absolute top-0 left-1/4 w-64 h-64">
          <div className="absolute inset-0 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        </div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64">
          <div className="absolute inset-0 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        </div>
      </div>
    </div>
  )
}
