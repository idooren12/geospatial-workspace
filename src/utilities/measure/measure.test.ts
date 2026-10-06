import { describe, expect, it } from 'vitest';
import { formatArea, formatDistance, formatDunam } from './format';
import { areaSquareMeters, lengthMeters, perimeterMeters } from './geodesic';

describe('geodesic measurement', () => {
  it('measures Tel Aviv → Jerusalem at about 54 km', () => {
    const m = lengthMeters([
      [34.7818, 32.0853],
      [35.2137, 31.7683],
    ]);
    expect(m / 1000).toBeGreaterThan(52);
    expect(m / 1000).toBeLessThan(56);
  });

  it('measures a 0.01° × 0.01° square near the equator at ~1.23 km²', () => {
    const ring = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
    ];
    expect(areaSquareMeters(ring) / 1e6).toBeCloseTo(1.236, 2);
    expect(perimeterMeters(ring) / 1000).toBeCloseTo(4.45, 1);
  });

  it('returns zero for too few points', () => {
    expect(lengthMeters([[0, 0]])).toBe(0);
    expect(areaSquareMeters([[0, 0], [1, 1]])).toBe(0);
  });
});

describe('formatting (Hebrew uses gershayim; English abbreviations)', () => {
  it('metric distance switches from m to km', () => {
    expect(formatDistance(523.4, 'metric', 'en')).toBe('523 m');
    expect(formatDistance(54_321, 'metric', 'en')).toBe('54.3 km');
    expect(formatDistance(54_321, 'metric', 'he')).toBe('54.3 ק״מ');
  });

  it('nautical and imperial distance', () => {
    expect(formatDistance(1852, 'nautical', 'en')).toBe('1 NM');
    expect(formatDistance(100, 'imperial', 'en')).toBe('328 ft');
    expect(formatDistance(16_093.44, 'imperial', 'en')).toBe('10 mi');
  });

  it('metric area goes m² → ha → km², with dunams alongside', () => {
    expect(formatArea(950, 'metric', 'en')).toBe('950 m²');
    expect(formatArea(25_000, 'metric', 'en')).toBe('2.5 ha');
    expect(formatArea(3_400_000, 'metric', 'en')).toBe('3.4 km²');
    expect(formatDunam(25_000, 'metric', 'he')).toBe('25 דונם');
    expect(formatDunam(25_000, 'nautical', 'he')).toBeNull();
  });

  it('imperial area goes ft² → acres → mi²', () => {
    expect(formatArea(100, 'imperial', 'en')).toBe('1,076 ft²');
    expect(formatArea(40_468.56, 'imperial', 'en')).toBe('10 ac');
  });
});
