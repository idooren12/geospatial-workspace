import type { CoordFormat } from '../../persistence/schema';

/** `32.08612 N, 34.78135 E` — 5 decimals ≈ 1.1 m (UTL-01). */
export function formatDecimal(lng: number, lat: number, decimals = 5): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)} ${ns}, ${Math.abs(wrapLng(lng)).toFixed(decimals)} ${ew}`;
}

/** `32°05'10.0" N, 34°46'52.9" E` */
export function formatDms(lng: number, lat: number): string {
  const part = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    let d = Math.floor(a);
    let m = Math.floor((a - d) * 60);
    let s = Math.round(((a - d) * 60 - m) * 600) / 10;
    if (s >= 60) {
      s = 0;
      m += 1;
    }
    if (m >= 60) {
      m = 0;
      d += 1;
    }
    return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1).padStart(4, '0')}" ${v >= 0 ? pos : neg}`;
  };
  return `${part(lat, 'N', 'S')}, ${part(wrapLng(lng), 'E', 'W')}`;
}

export function formatCoords(lng: number, lat: number, format: CoordFormat): string {
  return format === 'dms' ? formatDms(lng, lat) : formatDecimal(lng, lat);
}

/** Pointer positions past the antimeridian come back as e.g. 190°; normalize to [-180, 180). */
export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function formatZoom(z: number): string {
  return z.toFixed(1);
}
