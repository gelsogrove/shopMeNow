/* Mobile-First Webapp Theme */
export const theme = {
  // 🎨 Colori principali - palette italiana moderna
  colors: {
    primary: {
      50: "#f0f9ff",
      100: "#e0f2fe",
      500: "#0ea5e9", // Azzurro italiano
      600: "#0284c7",
      700: "#0369a1",
      900: "#0c4a6e",
    },
    secondary: {
      50: "#fefce8",
      100: "#fef3c7",
      500: "#eab308", // Oro italiano
      600: "#ca8a04",
      700: "#a16207",
    },
    success: {
      50: "#f0fdf4",
      500: "#22c55e", // Verde italiano
      600: "#16a34a",
    },
    warning: {
      50: "#fffbeb",
      500: "#f59e0b",
      600: "#d97706",
    },
    danger: {
      50: "#fef2f2",
      500: "#ef4444", // Rosso italiano
      600: "#dc2626",
    },
    neutral: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
  },

  // 📱 Breakpoints mobile-first
  breakpoints: {
    sm: "640px", // Small devices (mobile landscape)
    md: "768px", // Medium devices (tablets)
    lg: "1024px", // Large devices (desktop)
    xl: "1280px", // Extra large devices
  },

  // 📏 Spacing system
  spacing: {
    xs: "0.25rem", // 4px
    sm: "0.5rem", // 8px
    md: "1rem", // 16px
    lg: "1.5rem", // 24px
    xl: "2rem", // 32px
    "2xl": "3rem", // 48px
    "3xl": "4rem", // 64px
  },

  // 🔤 Typography
  typography: {
    fontFamily: {
      sans: ["Inter", "system-ui", "sans-serif"],
      display: ["Inter", "system-ui", "sans-serif"],
    },
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    },
  },

  // 🎯 Shadows & Effects
  effects: {
    shadow: {
      sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    },
    borderRadius: {
      sm: "0.25rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
      "2xl": "1rem",
    },
  },

  // 🚀 Animation
  animation: {
    transition: "all 0.2s ease-in-out",
    duration: {
      fast: "150ms",
      normal: "300ms",
      slow: "500ms",
    },
  },
}

// 📱 Mobile-first utility classes
export const mobileClasses = {
  container: "mx-auto px-4 sm:px-6 lg:px-8",
  card: "bg-white rounded-lg shadow-md border border-neutral-200",
  cardPadding: "p-4 sm:p-6",
  button: {
    base: "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
    primary:
      "bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-500",
    secondary:
      "bg-neutral-100 hover:bg-neutral-200 text-neutral-900 focus:ring-neutral-500",
    danger:
      "bg-danger-500 hover:bg-danger-600 text-white focus:ring-danger-500",
    sizes: {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    },
  },
  input:
    "w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white text-neutral-900 placeholder:text-neutral-400",
  searchInput:
    "w-full px-4 py-3 pl-10 border-0 bg-neutral-100 rounded-lg text-base focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all",
  mobileHeader:
    "sticky top-0 z-50 bg-white border-b border-neutral-200 px-4 py-3",
  mobileTitle: "text-lg font-semibold text-neutral-900 text-center",
  mobileBackButton:
    "absolute left-4 top-1/2 -translate-y-1/2 p-2 -ml-2 rounded-lg hover:bg-neutral-100",
}

// 🛠️ Component variants
export const componentVariants = {
  productCard: {
    mobile:
      "bg-white rounded-lg border border-neutral-200 p-4 space-y-3 hover:shadow-md transition-shadow",
    desktop:
      "bg-white rounded-xl border border-neutral-200 p-6 space-y-4 hover:shadow-lg transition-shadow",
  },
  orderCard: {
    mobile: "bg-white rounded-lg border border-neutral-200 p-4 space-y-3",
    desktop: "bg-white rounded-xl border border-neutral-200 p-6 space-y-4",
  },
}
