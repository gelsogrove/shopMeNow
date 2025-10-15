/**
 * ShopME Design System
 * Centralized design tokens for all public pages
 * Mobile-first approach with consistent styling
 */

export const designSystem = {
  // Color Palette
  colors: {
    // Primary Brand Colors
    primary: {
      50: "#f0f9ff",
      100: "#e0f2fe",
      200: "#bae6fd",
      300: "#7dd3fc",
      400: "#38bdf8",
      500: "#0ea5e9", // Main primary
      600: "#0284c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
    },
    // Secondary/Accent
    secondary: {
      50: "#f0fdf4",
      100: "#dcfce7",
      200: "#bbf7d0",
      300: "#86efac",
      400: "#4ade80",
      500: "#22c55e", // Main secondary (green)
      600: "#16a34a",
      700: "#15803d",
      800: "#166534",
      900: "#14532d",
    },
    // Accent/Warning
    accent: {
      50: "#fff7ed",
      100: "#ffedd5",
      200: "#fed7aa",
      300: "#fdba74",
      400: "#fb923c",
      500: "#f97316", // Main accent (orange)
      600: "#ea580c",
      700: "#c2410c",
      800: "#9a3412",
      900: "#7c2d12",
    },
    // Error/Danger
    error: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#ef4444", // Main error
      600: "#dc2626",
      700: "#b91c1c",
      800: "#991b1b",
      900: "#7f1d1d",
    },
    // Neutral Grays
    gray: {
      50: "#f9fafb",
      100: "#f3f4f6",
      200: "#e5e7eb",
      300: "#d1d5db",
      400: "#9ca3af",
      500: "#6b7280",
      600: "#4b5563",
      700: "#374151",
      800: "#1f2937",
      900: "#111827",
    },
    // Background & Surface
    background: {
      main: "#f9fafb", // gray-50
      card: "#ffffff",
      hover: "#f3f4f6", // gray-100
      disabled: "#e5e7eb", // gray-200
    },
    // Text
    text: {
      primary: "#111827", // gray-900
      secondary: "#4b5563", // gray-600
      tertiary: "#9ca3af", // gray-400
      disabled: "#d1d5db", // gray-300
      inverse: "#ffffff",
    },
    // Borders
    border: {
      light: "#e5e7eb", // gray-200
      main: "#d1d5db", // gray-300
      dark: "#9ca3af", // gray-400
    },
    // Status Colors
    status: {
      success: "#22c55e",
      warning: "#f97316",
      error: "#ef4444",
      info: "#0ea5e9",
    },
  },

  // Typography
  typography: {
    // Font Families
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },

    // Font Sizes (mobile-first, rem-based)
    fontSize: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      "2xl": "1.5rem", // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem", // 36px
      "5xl": "3rem", // 48px
    },

    // Font Weights
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },

    // Line Heights
    lineHeight: {
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
      loose: "2",
    },

    // Letter Spacing
    letterSpacing: {
      tighter: "-0.05em",
      tight: "-0.025em",
      normal: "0",
      wide: "0.025em",
      wider: "0.05em",
      widest: "0.1em",
    },
  },

  // Spacing Scale (consistent padding/margin)
  spacing: {
    0: "0",
    1: "0.25rem", // 4px
    2: "0.5rem", // 8px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    8: "2rem", // 32px
    10: "2.5rem", // 40px
    12: "3rem", // 48px
    16: "4rem", // 64px
    20: "5rem", // 80px
    24: "6rem", // 96px
  },

  // Border Radius
  borderRadius: {
    none: "0",
    sm: "0.25rem", // 4px
    base: "0.5rem", // 8px
    md: "0.75rem", // 12px
    lg: "1rem", // 16px
    xl: "1.5rem", // 24px
    "2xl": "2rem", // 32px
    full: "9999px",
  },

  // Shadows
  shadow: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
    none: "none",
  },

  // Z-Index Layers
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },

  // Breakpoints (mobile-first)
  breakpoints: {
    xs: "375px",
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  // Animation Durations
  animation: {
    fast: "150ms",
    base: "250ms",
    slow: "350ms",
    slower: "500ms",
  },

  // Transitions
  transition: {
    all: "all 250ms ease-in-out",
    colors: "background-color 250ms ease-in-out, color 250ms ease-in-out",
    transform: "transform 250ms ease-in-out",
    opacity: "opacity 250ms ease-in-out",
  },

  // Touch Targets (for mobile accessibility)
  touchTarget: {
    minHeight: "44px",
    minWidth: "44px",
  },

  // Common Component Styles
  components: {
    // Button Styles (DIMENSIONI NORMALI, non enormi)
    button: {
      base: {
        fontWeight: "600",
        borderRadius: "0.625rem", // 10px (più moderno)
        transition: "all 200ms ease-in-out",
        minHeight: "40px", // 40px invece di 44px (meno gigante)
        padding: "0.625rem 1rem", // 10px 16px (più compatto)
        fontSize: "0.875rem", // 14px
      },
      sm: {
        minHeight: "36px",
        padding: "0.5rem 0.875rem", // 8px 14px
        fontSize: "0.8125rem", // 13px
      },
      variants: {
        primary: {
          background: "#22c55e",
          color: "#ffffff",
          hover: "#16a34a",
          active: "#15803d",
          disabled: "#d1d5db",
        },
        secondary: {
          background: "#0ea5e9",
          color: "#ffffff",
          hover: "#0284c7",
          active: "#0369a1",
          disabled: "#d1d5db",
        },
        outline: {
          background: "transparent",
          border: "1px solid #d1d5db", // 1px invece di 2px
          color: "#4b5563",
          hover: "#f9fafb",
          disabled: "#e5e7eb",
        },
        ghost: {
          background: "transparent",
          color: "#4b5563",
          hover: "#f9fafb",
          disabled: "#e5e7eb",
        },
      },
    },

    // Card Styles (FLAT DESIGN - NO bordi multipli)
    card: {
      background: "#ffffff",
      borderRadius: "0.75rem", // 12px (più moderno)
      shadow: "0 1px 3px 0 rgba(0, 0, 0, 0.08)", // Shadow leggero
      padding: "1rem", // 16px
      border: "none", // NO border - solo shadow
    },
    
    // Card interna (se proprio necessaria - ma evitare nesting)
    cardInner: {
      background: "#f9fafb",
      borderRadius: "0.5rem", // 8px
      padding: "0.75rem", // 12px
      border: "none",
    },

    // Input Styles
    input: {
      base: {
        height: "44px",
        padding: "0.75rem 1rem", // 12px 16px
        fontSize: "1rem", // 16px (prevents zoom on mobile)
        borderRadius: "0.75rem", // 12px
        border: "1px solid #d1d5db",
        background: "#ffffff",
        transition: "all 250ms ease-in-out",
      },
      focus: {
        borderColor: "#0ea5e9",
        outline: "2px solid rgba(14, 165, 233, 0.2)",
        outlineOffset: "2px",
      },
      error: {
        borderColor: "#ef4444",
        outline: "2px solid rgba(239, 68, 68, 0.2)",
      },
    },

    // Header Styles
    header: {
      height: "60px", // Compact height - reduced from 80px
      background: "#ffffff",
      shadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      padding: "0 1rem", // 16px
      zIndex: 1020,
    },
  },
}

// Helper function to get responsive padding
export const getResponsivePadding = (mobile: string, desktop: string) => ({
  padding: mobile,
  "@media (min-width: 640px)": {
    padding: desktop,
  },
})

// Helper function to create consistent spacing
export const spacing = (scale: keyof typeof designSystem.spacing) =>
  designSystem.spacing[scale]

// Helper function for typography
export const fontSize = (size: keyof typeof designSystem.typography.fontSize) =>
  designSystem.typography.fontSize[size]

// Helper function for colors
export const color = (
  category: keyof typeof designSystem.colors,
  shade: number | string = "main"
) => {
  const colorCategory = designSystem.colors[category]
  if (typeof colorCategory === "object" && shade in colorCategory) {
    return colorCategory[shade as keyof typeof colorCategory]
  }
  return colorCategory
}

// Export as default
export default designSystem
