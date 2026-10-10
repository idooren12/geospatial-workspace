# Attribution and licensing audit (M5)

Attribution is treated as a compliance requirement: it is always shown, never covered, clickable,
and correct for the basemap on screen. Checked 2026-10-09.

## How it is shown

- MapLibre's `AttributionControl` with `compact: false`, so it is never collapsed into an (i) button.
  It sits in the bottom corner on the map-controls side, with the scale stacked *above* it, so
  nothing overlaps it. The status bar is outside the map (since M5), so nothing floats over it.
- On a narrow map (docks open on both sides, map at its 500 px minimum) the text wraps instead of
  being cut off (`global.css`, sized against the map container with `cqw`).
- Credits come from the style's sources, so they always match what is drawn. Switching basemap
  switches the credits.
- Guarded by E2E tests at map widths ~800, ~640 and 500 px, for each basemap
  (`e2e/responsive.spec.ts`), and by visual snapshots (`e2e/visual.spec.ts`).

## Per basemap

| Basemap | Provider / data | Credit shown | Licence and terms | Key / secret |
| --- | --- | --- | --- | --- |
| Map (light, dark) | OpenFreeMap styles (`positron`, `dark`), OpenMapTiles schema, OpenStreetMap data | `OpenFreeMap © OpenMapTiles Data from OpenStreetMap` (links to openfreemap.org, openmaptiles.org, openstreetmap.org/copyright) — supplied by the tiles' TileJSON | OSM data: ODbL — credit required. OpenMapTiles: CC-BY 4.0 — credit required. OpenFreeMap ToS: free, no key, no stated quota, no warranty, may be discontinued without notice | None |
| Satellite | Esri World Imagery (public endpoint; keyed ArcGIS Location Platform endpoint when `VITE_ARCGIS_API_KEY` is set) | `Powered by Esri | Imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community` | Esri Master License Agreement. Esri requires "Powered by Esri" in any app using its services, plus the layer's own credits (the item's current credit line names Vantor, formerly Maxar). The layer may not be used to export tiles for offline use. | Optional public client key, Basemaps privilege, referrer-restricted (below) |
| Satellite labels/borders | OpenFreeMap `positron` symbols and boundary lines on top of the imagery | OpenFreeMap credit added automatically when those layers are present | as above | None |
| Label fonts | Noto Sans glyphs served by OpenFreeMap | — | SIL Open Font License | None |

## Esri production licence (M5.1)

Esri's terms tie use of its basemap services to an ArcGIS account. The code is ready for an ArcGIS
Location Platform key:

- With `VITE_ARCGIS_API_KEY` set at build time, imagery comes from
  `ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=…`,
  counted against the owner's account.
- Without it, the anonymous public endpoint is used (development / evaluation). This is the current
  production state until the owner adds the key.
- The key is public by design (inlined in the bundle). It is restricted in the ArcGIS dashboard to
  the **Basemaps** privilege and the site's referrer, and it expires within a year.
- Assumed usage: free tier 2,000,000 basemap tiles/month, then $0.15 per 1,000. That is tens of
  thousands of satellite screen views per month. Check location.arcgis.com/pricing.
- Attribution is identical in both modes: "Powered by Esri" plus the World Imagery credits.

Owner steps (account, key, Vercel variable, redeploy, verification): docs/ENV.md.

## Secrets

There are no secrets in the repository or the client bundle (checked with a pattern scan of
`dist/`). The optional ArcGIS key is a public, referrer-restricted client key, not a secret. It
lives only in Vercel's environment settings, never in the repository. There is no backend.
