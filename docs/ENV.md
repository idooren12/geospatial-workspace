# Environment variables

The app is static; there are no server secrets. Values are never committed — only names and where
they are set.

| Name | Purpose | Where | Required |
| --- | --- | --- | --- |
| `VITE_ARCGIS_API_KEY` | ArcGIS Location Platform API key for the Satellite basemap (Esri World Imagery through `ibasemaps-api.arcgis.com`). Without it the app falls back to Esri's anonymous public endpoint (development / evaluation only). | Vercel → Project `geospatial-workspace` → Settings → Environment Variables (Production; optionally Preview) | No |

## About `VITE_ARCGIS_API_KEY`

- **It is public by design.** Every `VITE_` variable is inlined into the JavaScript bundle at build
  time, so anyone can read it in the browser. That is how Esri's client keys are meant to work;
  protection comes from the key's own limits, set in the ArcGIS dashboard:
  - **Privileges: Basemaps only** (`premium:user:basemaps`). Nothing else: no geocoding, routing,
    data, or admin privileges.
  - **Referrers:** `https://geospatial-workspace.vercel.app/*` (plus Vercel preview domains or
    `http://localhost:5173/*` only if you want the key there too).
  - An **expiration date** (Esri keys expire; set a reminder to rotate).
- **Usage and cost.** The free tier is 2,000,000 basemap tiles per month, then $0.15 per 1,000.
  A satellite view uses roughly 15–40 tiles per screen, plus panning and zooming. That is on the
  order of tens of thousands of full views per month before charges. Esri can change the plan;
  check location.arcgis.com/pricing.
- **Attribution does not change.** "Powered by Esri" and the imagery credits are shown with or
  without the key.
- **Changing it** takes a redeploy: Vercel inlines `VITE_` variables at build time.

## Owner steps to switch Satellite to the keyed endpoint

1. **Create the account.**
   1. Go to https://location.arcgis.com and click **Sign up for free**. This is ArcGIS Location
      Platform, not ArcGIS Online.
   2. Fill in your details, confirm via the email link, sign in and finish the short onboarding.
2. **Create the API key** (dashboard → **Developer credentials → Create developer credentials**):
   1. **API key credentials** → Next.
   2. *Where will you use these credentials?* → **Public application** → Next.
   3. *Item access* → grant access to specific items, but select **none** → Next.
   4. *Privileges* → under **Location services**, enable **Basemaps** only → Next.
   5. *Settings* → **Expiration date**: the maximum is one year, so set a calendar reminder to
      rotate. **Referrer URLs**: `https://geospatial-workspace.vercel.app` (and
      `http://localhost:5173` only if you want the key in local development too) → Next.
   6. *Item details* → title `geospatial-workspace satellite` → Next.
   7. Summary → keep **Generate the API key now** → Next. Copy the key immediately; it is shown
      only once. If you lose it, regenerate it from the credential item.
3. **Put it in Vercel.**
   1. https://vercel.com → project **geospatial-workspace** → **Settings → Environment
      Variables**.
   2. **Key:** `VITE_ARCGIS_API_KEY`. **Value:** the key.
   3. **Environments:** Production (add Preview only if that key's referrers include preview
      URLs).
   4. Save.
4. **Redeploy.** Go to **Deployments**, open the latest Production deployment, choose **⋯ →
   Redeploy**, and leave "use existing build cache" unticked. A new push to `main` also works.
5. **Check it.** Open the site, switch to Satellite, and open the browser dev tools Network tab.
   Tile requests now go to `ibasemaps-api.arcgis.com`. In the ArcGIS dashboard, **Usage** shows
   basemap tiles counting up within a few hours.
6. **To roll back:** delete the variable and redeploy. The app returns to the public endpoint.
