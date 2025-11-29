/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ADMIN_USERNAME: string
  readonly VITE_ADMIN_PASSWORD: string
  readonly VITE_BACKOFFICE_USERNAME: string
  readonly VITE_BACKOFFICE_PASSWORD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
