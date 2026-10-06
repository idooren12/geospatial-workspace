import type { ScaleUnit } from '../../map/types';

export type Lang = 'he' | 'en';

/** Unit abbreviations; Hebrew uses gershayim (מ״ר, ק״מ). */
const U = {
  he: { m: 'מ׳', km: 'ק״מ', nm: 'מ״י', ft: 'רגל', mi: 'מייל', m2: 'מ״ר', ha: 'הקטאר', km2: 'קמ״ר', nm2: 'מ״י²', ft2: 'רגל²', ac: 'אקר', mi2: 'מייל²', dunam: 'דונם' },
  en: { m: 'm', km: 'km', nm: 'NM', ft: 'ft', mi: 'mi', m2: 'm²', ha: 'ha', km2: 'km²', nm2: 'NM²', ft2: 'ft²', ac: 'ac', mi2: 'mi²', dunam: 'dunam' },
} as const;

const M_PER_NM = 1852;
const M_PER_FT = 0.3048;
const M_PER_MI = 1609.344;

function num(value: number, lang: Lang, maxFraction: number): string {
  return new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    maximumFractionDigits: maxFraction,
    minimumFractionDigits: 0,
  }).format(value);
}

/** Digits after the point that keep ~3–4 significant figures without noise. */
const digits = (v: number) => (v >= 100 ? 0 : v >= 10 ? 1 : 2);

/** Human-readable distance in the chosen unit system (UTL-03). */
export function formatDistance(meters: number, units: ScaleUnit, lang: Lang): string {
  const u = U[lang];
  if (units === 'nautical') {
    const nm = meters / M_PER_NM;
    return `${num(nm, lang, nm >= 100 ? 0 : nm >= 10 ? 1 : nm >= 1 ? 2 : 3)} ${u.nm}`;
  }
  if (units === 'imperial') {
    const ft = meters / M_PER_FT;
    if (ft < 5280) return `${num(ft, lang, 0)} ${u.ft}`;
    const mi = meters / M_PER_MI;
    return `${num(mi, lang, digits(mi))} ${u.mi}`;
  }
  if (meters < 1000) return `${num(meters, lang, meters < 10 ? 1 : 0)} ${u.m}`;
  const km = meters / 1000;
  return `${num(km, lang, digits(km))} ${u.km}`;
}

/** Human-readable area (UTL-04). Metric goes m² → ha → km². */
export function formatArea(squareMeters: number, units: ScaleUnit, lang: Lang): string {
  const u = U[lang];
  if (units === 'nautical') {
    const nm2 = squareMeters / (M_PER_NM * M_PER_NM);
    return `${num(nm2, lang, nm2 >= 100 ? 0 : nm2 >= 1 ? 2 : 4)} ${u.nm2}`;
  }
  if (units === 'imperial') {
    const ft2 = squareMeters / (M_PER_FT * M_PER_FT);
    if (ft2 < 43_560) return `${num(ft2, lang, 0)} ${u.ft2}`;
    const ac = ft2 / 43_560;
    if (ac < 640) return `${num(ac, lang, digits(ac))} ${u.ac}`;
    const mi2 = ac / 640;
    return `${num(mi2, lang, digits(mi2))} ${u.mi2}`;
  }
  if (squareMeters < 10_000) return `${num(squareMeters, lang, 0)} ${u.m2}`;
  if (squareMeters < 1_000_000) {
    const ha = squareMeters / 10_000;
    return `${num(ha, lang, digits(ha))} ${u.ha}`;
  }
  const km2 = squareMeters / 1_000_000;
  return `${num(km2, lang, digits(km2))} ${u.km2}`;
}

/** Metric areas also in dunams (1,000 m²), the everyday unit in Israel. Null when not metric. */
export function formatDunam(squareMeters: number, units: ScaleUnit, lang: Lang): string | null {
  if (units !== 'metric') return null;
  const d = squareMeters / 1000;
  return `${num(d, lang, digits(d))} ${U[lang].dunam}`;
}
