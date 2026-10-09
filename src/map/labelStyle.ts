/**
 * Readable labels for workspace geometry on every basemap (light, dark, imagery): dark text on a
 * light, slightly translucent "pill" with a thin outline. A text halo alone washes out on busy
 * imagery and on dark maps; a background does not. The pill is a stretchable image fitted to the
 * text (icon-text-fit), so it works for Hebrew, English and mixed text alike.
 */
export const LABEL_BG = 'ws:label-bg';
export const LABEL_BG_SELECTED = 'ws:label-bg-selected';
export const LABEL_FONT = ['Noto Sans Bold'];

export interface PillImage {
  width: number;
  height: number;
  data: Uint8Array;
  options: {
    pixelRatio: number;
    stretchX: [number, number][];
    stretchY: [number, number][];
    content: [number, number, number, number];
  };
}

type RGBA = [number, number, number, number];

/** Draws a rounded rectangle with a 1-device-pixel-ish outline into raw RGBA (no canvas needed). */
export function pillImage(fill: RGBA, stroke: RGBA, pixelRatio = 2): PillImage {
  const r = 5 * pixelRatio;
  const w = 2 * r + 4;
  const h = 2 * r + 4;
  const data = new Uint8Array(w * h * 4);
  const sw = 1.25 * pixelRatio;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Distance to the rounded-rect edge (negative inside).
      const cx = Math.min(Math.max(x + 0.5, r), w - r);
      const cy = Math.min(Math.max(y + 0.5, r), h - r);
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r;
      const inside = Math.min(1, Math.max(0, 0.5 - d)); // antialiased coverage
      if (inside <= 0) continue;
      const strokeMix = Math.min(1, Math.max(0, d + sw + 0.5));
      const c = fill.map((v, i) => v + (stroke[i]! - v) * strokeMix) as RGBA;
      const o = (y * w + x) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = Math.round(c[3] * inside);
    }
  }
  return {
    width: w,
    height: h,
    data,
    options: { pixelRatio, stretchX: [[r, w - r]], stretchY: [[r, h - r]], content: [r - 2, r - 2, w - r + 2, h - r + 2] },
  };
}

export const LABEL_IMAGES: Record<string, PillImage> = {
  [LABEL_BG]: pillImage([255, 255, 255, 235], [20, 24, 28, 140]),
  [LABEL_BG_SELECTED]: pillImage([61, 139, 253, 255], [255, 255, 255, 255]),
};

/** Symbol layout for a label read from a feature property, on the pill background. */
export function labelLayout(field: unknown, selected = false): Record<string, unknown> {
  return {
    'text-field': field,
    'text-font': LABEL_FONT,
    'text-size': 12.5,
    'text-max-width': 14,
    'text-padding': 2,
    'icon-image': selected ? LABEL_BG_SELECTED : LABEL_BG,
    'icon-text-fit': 'both',
    'icon-text-fit-padding': [2, 6, 2, 6],
    'icon-allow-overlap': false,
    'text-optional': false,
  };
}

export const LABEL_PAINT = { 'text-color': '#16191d' } as const;
export const LABEL_PAINT_SELECTED = { 'text-color': '#ffffff' } as const;

/** Convenience for point labels: below the marker. Lines/polygons keep the default placement. */
export const POINT_LABEL_OFFSET = { 'text-anchor': 'top', 'text-offset': [0, 1.1] } as const;
