/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_DEXIE_CLOUD_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
