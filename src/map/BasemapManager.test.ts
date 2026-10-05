import { describe, expect, it, vi } from 'vitest';
import { BasemapManager, buildImageryStyle } from './BasemapManager';
import type { RasterBasemap, StyleSpecification } from './types';

const labels: StyleSpecification = {
  version: 8,
  glyphs: 'https://example.test/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://example.test/sprite',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://example.test/planet' },
    unused: { type: 'vector', url: 'https://example.test/unused' },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
    { id: 'road', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation' },
    { id: 'boundary_2', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary' },
    {
      id: 'label_city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: { 'text-field': ['get', 'name'] },
      paint: { 'text-color': '#333' },
    },
  ],
};

const sat: RasterBasemap = {
  id: 'sat',
  nameKey: 'x',
  icon: 'satellite',
  kind: 'raster',
  imagery: { tiles: ['https://img.test/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: '© Imagery' },
  labelsStyleUrl: 'https://example.test/style',
};

describe('buildImageryStyle', () => {
  it('puts imagery at the bottom and keeps only borders and labels on top', () => {
    const style = buildImageryStyle(sat, labels);
    expect(style.layers.map((l) => l.id)).toEqual(['basemap-imagery', 'boundary_2', 'label_city']);
    expect(Object.keys(style.sources).sort()).toEqual(['basemap-imagery', 'openmaptiles']);
    expect(style.glyphs).toBe(labels.glyphs);
  });

  it('recolours labels for a photographic background without touching the source style', () => {
    const style = buildImageryStyle(sat, labels);
    const city = style.layers.find((l) => l.id === 'label_city') as { paint: Record<string, unknown> };
    expect(city.paint['text-color']).toBe('#ffffff');
    expect((labels.layers[4] as { paint: Record<string, unknown> }).paint['text-color']).toBe('#333');
  });

  it('falls back to imagery alone when there is no label style', () => {
    const style = buildImageryStyle(sat, null);
    expect(style.layers).toHaveLength(1);
    expect(style.sources['basemap-imagery']).toMatchObject({ type: 'raster', attribution: '© Imagery' });
  });
});

describe('BasemapManager', () => {
  it('returns the theme URL for the vector map and ignores theme for satellite', async () => {
    const light = await BasemapManager.styleFor('map', 'light');
    const dark = await BasemapManager.styleFor('map', 'dark');
    expect(typeof light).toBe('string');
    expect(light).not.toBe(dark);
    const fetchJson = vi.fn().mockResolvedValue(labels);
    const s1 = await BasemapManager.styleFor('satellite', 'light', fetchJson);
    const s2 = await BasemapManager.styleFor('satellite', 'dark', fetchJson);
    expect(typeof s1).toBe('object');
    expect(s1).toEqual(s2);
    expect(fetchJson).toHaveBeenCalledTimes(1); // label style fetched once, then cached
  });

  it('falls back to the default basemap for unknown ids', () => {
    expect(BasemapManager.resolve('nope').id).toBe('map');
    expect(BasemapManager.hasThemes(BasemapManager.resolve('map'))).toBe(true);
    expect(BasemapManager.hasThemes(BasemapManager.resolve('satellite'))).toBe(false);
  });
});
