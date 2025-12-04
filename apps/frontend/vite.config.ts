import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

// Lista dei moduli mancanti che devono essere trattati come esterni
const externalModules = [
  "@tanstack/react-query",
  "react-hook-form",
  "react-hot-toast",
  "sonner",
  "@hookform/resolvers/zod",
  "react-day-picker",
  "cmdk",
  "vaul",
]

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Ignora errori TypeScript durante lo sviluppo
    logOverride: { "this-is-undefined-in-esm": "silent" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost", // 🍪 Forward cookies correctly
        cookiePathRewrite: "/", // 🍪 Ensure cookies work across all paths
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            // Production: Silent error handling
            if (process.env.NODE_ENV === "development") {
              console.error("Proxy error:", err)
            }
          })
        },
      },
      // 🔐 Backoffice proxy - localhost:3000/admin → localhost:3002
      "/admin": {
        target: "http://localhost:3002",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/admin/, ''),  // /admin/foo → /foo
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            if (process.env.NODE_ENV === "development") {
              console.error("Proxy error for backoffice:", err)
            }
          })
        },
      },
      "/workspaces": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            if (process.env.NODE_ENV === "development") {
              console.error("Proxy error:", err)
            }
          })
        },
      },
      // ✅ Short URLs - proxy to backend for direct HTTP 302 redirect
      // Pattern: ^/s/ matches /s/XXXXX but NOT /src, /static, etc.
      // This ensures short URLs work on FIRST click (no SPA hydration needed)
      "^/s/": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            if (process.env.NODE_ENV === "development") {
              console.error("Proxy error for short URLs:", err)
            }
          })
        },
      },
    },
  },
  assetsInclude: ["**/*.svg"],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignora warnings TypeScript e importazioni non risolte
        if (
          warning.code?.startsWith("TS") ||
          warning.code === "UNRESOLVED_IMPORT"
        ) {
          return
        }
        warn(warning)
      },
      external: externalModules,
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
          ],
          utils: ["clsx", "tailwind-merge", "class-variance-authority"],
        },
      },
    },
    minify: true,
    sourcemap: true,
    emptyOutDir: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
  },
})
