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
| Satellite | Esri World Imagery (public tile endpoint) | `Powered by Esri | Imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community` | Esri Master License Agreement. Esri requires "Powered by Esri" in any app using its services, plus the layer's own credits (the item's current credit line names Vantor, formerly Maxar). The layer may not be used to export tiles for offline use. | None today — see open decision |
| Satellite labels/borders | OpenFreeMap `positron` symbols and boundary lines on top of the imagery | OpenFreeMap credit added automatically when those layers are present | as above | None |
| Label fonts | Noto Sans glyphs served by OpenFreeMap | — | SIL Open Font License | None |

## Open decision (owner)

Esri's terms tie use of its basemap services to an ArcGIS account. Using the anonymous endpoint is
fine for development and evaluation; for production use the options are:

1. An ArcGIS Location Platform account and API key (a free tier exists). The key would be a public,
   referrer-restricted client key in `basemaps.config.ts` — not a secret, but it must be restricted
   to the site's domain in the ArcGIS dashboard.
2. Another imagery provider (e.g. MapTiler Satellite, also key-based).

Either is a one-entry change in `src/map/basemaps.config.ts`; nothing else in the app changes.

## Secrets

There are no API keys, tokens or secrets in the repository or the client bundle (checked with a
pattern scan of `dist/`). There is no backend. `docs/ENV.md` lists environment variables (none).
