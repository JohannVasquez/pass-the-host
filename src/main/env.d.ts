// Injected at build time by electron-vite from .env (locally) or CI secrets.
interface ImportMetaEnv {
  readonly MAIN_VITE_GDRIVE_CLIENT_ID?: string;
  readonly MAIN_VITE_GDRIVE_CLIENT_SECRET?: string;
  readonly MAIN_VITE_API_URL?: string;
}
