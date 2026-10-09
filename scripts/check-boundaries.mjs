#!/usr/bin/env node
/**
 * Architecture guard (runs in CI): enforces the module boundaries from the Stage 0 spec.
 *
 *  1. `maplibre-gl` is imported only inside src/map/          (MAP-03)
 *  2. src/tools/** never imports src/map or src/layout          (tools get ToolContext only)
 *  3. Basemap provider hosts appear only in basemaps.config.ts  (DoD 15)
 *  4. No domain logic in the platform core                      (DoD 21)
 *  5. No physical left/right CSS outside the map (RTL support); opt out with  physical-ok
 *  6. Map Core (src/map) imports nothing from the rest of the app            (M5 architecture review)
 *  7. Storage APIs (localStorage / sessionStorage / indexedDB) only in src/persistence
 *  8. The layer system (src/layers) knows no tools or utilities (e.g. Draw)
 *  9. Generic UI primitives (src/ui) know no store, map or app
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(src).map((abs) => ({ abs, rel: relative(root, abs).split(sep).join('/') }));
const errors = [];
const report = (file, line, msg) => errors.push(`${file}:${line}  ${msg}`);

const CORE = /^src\/(map|layout|layers|panels|store|app|utilities|ui|styles|i18n|persistence|history)\/|^src\/tools\/(ToolRegistry|types|index)\.ts$/;
const DOMAIN = /\b(weather|grib|fresnel|linkBudget|link-budget|calculateRF|droneZone|lineOfSight)\b/i;
const PROVIDER = /openfreemap\.org|tile\.openstreetmap\.org|api\.mapbox\.com|maptiler\.com|arcgisonline\.com/;
const STORAGE = /\b(localStorage|sessionStorage|indexedDB)\b/;
/** Directory a relative import resolves into, e.g. "../store/x" from src/map/y.ts → "src/store". */
function importTarget(rel, spec) {
  if (!spec.startsWith('.')) return null;
  const parts = rel.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.slice(0, 2).join('/');
}
const PHYSICAL_CSS =
  /(^|[\s;{])(margin|padding|border)-(left|right)\s*:|(^|[\s;{])(left|right)\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)/;

for (const { abs, rel } of files) {
  if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const isCode = /\.(ts|tsx)$/.test(rel);
  const isCss = rel.endsWith('.css');

  lines.forEach((ln, i) => {
    const n = i + 1;
    if (isCode) {
      const imp = ln.match(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/);
      const spec = imp?.[1] ?? imp?.[2];
      if (spec) {
        if (/^maplibre-gl(\/|$)/.test(spec) && !rel.startsWith('src/map/'))
          report(rel, n, `maplibre-gl may only be imported in src/map (found "${spec}")`);
        if (rel.startsWith('src/tools/') && /(^|\/)(map|layout)\//.test(spec) && !/\/map\/types$/.test(spec))
          report(rel, n, `tools must not import map/layout internals; use ToolContext (found "${spec}")`);
        const target = importTarget(rel, spec);
        if (target && rel.startsWith('src/map/') && target !== 'src/map')
          report(rel, n, `Map Core must not depend on the app (found "${spec}")`);
        if (target && rel.startsWith('src/layers/') && /^src\/(utilities|panels|app)$/.test(target))
          report(rel, n, `the layer system must stay generic; no tool/utility imports (found "${spec}")`);
        if (target && rel.startsWith('src/ui/') && /^src\/(store|map|app|layers|panels|utilities|persistence)$/.test(target))
          report(rel, n, `generic UI must not import app modules (found "${spec}")`);
      }
      if (CORE.test(rel) && DOMAIN.test(ln)) report(rel, n, `domain-specific term in platform core: ${ln.trim()}`);
      if (STORAGE.test(ln) && !rel.startsWith('src/persistence/') && !/^\s*(\/\/|\*|\/\*)/.test(ln))
        report(rel, n, `storage access outside src/persistence: ${ln.trim()}`);
    }
    if (PROVIDER.test(ln) && rel !== 'src/map/basemaps.config.ts')
      report(rel, n, 'basemap provider URL outside src/map/basemaps.config.ts');
    if (isCss && !rel.startsWith('src/map/') && PHYSICAL_CSS.test(ln) && !ln.includes('physical-ok'))
      report(rel, n, `physical left/right CSS breaks RTL; use logical properties: ${ln.trim()}`);
  });
}

if (errors.length) {
  console.error(`Architecture check failed (${errors.length}):\n` + errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
console.log(`Architecture check passed (${files.length} files).`);
