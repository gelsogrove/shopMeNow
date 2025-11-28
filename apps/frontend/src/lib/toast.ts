import { toast as sonnerToast } from "sonner"

interface ToastOptions {
  duration?: number
  position?:
    | "top-center"
    | "top-right"
    | "top-left"
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
}

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    sonnerToast.success(message, {
      duration: options?.duration || 1000,
      style: {
        background: "#22c55e",
        color: "#ffffff",
        border: "none",
      },
      icon: "✓",
    })
  },

  error: (message: string, options?: ToastOptions) => {
    sonnerToast.error(message, {
      duration: options?.duration || 1000,
      style: {
        background: "#dc2626",
        color: "#ffffff",
        border: "none",
      },
      icon: "❌",
    })
  },

  warning: (message: string, options?: ToastOptions) => {
    sonnerToast.warning(message, {
      duration: options?.duration || 1000,
      style: {
        background: "#fbbf24",
        color: "#ffffff",
        border: "none",
      },
      icon: "⚠️",
    })
  },

  info: (message: string, options?: ToastOptions) => {
    sonnerToast.info(message, {
      duration: options?.duration || 1000,
      style: {
        background: "#3b82f6",
        color: "#ffffff",
        border: "none",
      },
      icon: "ℹ️",
    })
  },
}
