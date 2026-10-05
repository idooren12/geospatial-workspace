import { describe, expect, it } from 'vitest';
import { formatDecimal, formatDms, formatZoom, wrapLng } from './format';

describe('coordinate formatting', () => {
  it('formats decimal degrees with 5 decimals and hemispheres (UTL-01)', () => {
    expect(formatDecimal(34.781351, 32.086123)).toBe('32.08612 N, 34.78135 E');
    expect(formatDecimal(-70.5, -33.25)).toBe('33.25000 S, 70.50000 W');
  });

  it('formats degrees-minutes-seconds and carries rounding over', () => {
    expect(formatDms(34.78135, 32.08612)).toBe(`32°05'10.0" N, 34°46'52.9" E`);
    expect(formatDms(0.9999999, 0)).toBe(`0°00'00.0" N, 1°00'00.0" E`);
  });

  it('wraps longitudes past the antimeridian', () => {
    expect(wrapLng(190)).toBe(-170);
    expect(wrapLng(-190)).toBe(170);
  });

  it('shows zoom with one decimal (UTL-02)', () => {
    expect(formatZoom(11.4321)).toBe('11.4');
  });
});
