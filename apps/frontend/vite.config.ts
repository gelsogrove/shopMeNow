import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

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
    fs: {
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname, "../../shared")],
    },
    proxy: {
      "/api/v1": {
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
        // Ignora solo warnings TypeScript
        if (warning.code?.startsWith("TS")) {
          return
        }
        warn(warning)
      },
      // ✅ EXPLICIT input specification for Heroku
      // MUST use import.meta.url because __dirname points to monorepo root in Heroku build
      input: new URL('./index.html', import.meta.url).pathname,
      // NO external modules - everything must be bundled for production!
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "@tanstack/react-query"],
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
