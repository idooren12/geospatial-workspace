#!/usr/bin/env node
/**
 * Architecture guard (runs in CI): enforces the module boundaries from the Stage 0 spec.
 *
 *  1. `maplibre-gl` is imported only inside src/map/          (MAP-03)
 *  2. src/tools/** never imports src/map or src/layout          (tools get ToolContext only)
 *  3. Basemap provider hosts appear only in basemaps.config.ts  (DoD 15)
 *  4. No domain logic in the platform core                      (DoD 21)
 *  5. No physical left/right CSS outside the map (RTL support); opt out with  physical-ok
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

const CORE = /^src\/(map|layout|layers|panels|store|app|utilities|ui|styles|i18n)\/|^src\/tools\/(ToolRegistry|types|index)\.ts$/;
const DOMAIN = /\b(weather|grib|fresnel|linkBudget|link-budget|calculateRF|droneZone|lineOfSight)\b/i;
const PROVIDER = /openfreemap\.org|tile\.openstreetmap\.org|api\.mapbox\.com|maptiler\.com/;
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
      }
      if (CORE.test(rel) && DOMAIN.test(ln)) report(rel, n, `domain-specific term in platform core: ${ln.trim()}`);
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
