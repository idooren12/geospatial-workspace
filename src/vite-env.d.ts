/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ArcGIS Location Platform API key for Esri World Imagery (public, referrer-restricted). Optional. */
  readonly VITE_ARCGIS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
