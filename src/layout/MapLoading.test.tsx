import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapLoadState } from '../map/MapService';
import { initI18n } from '../i18n';

let state: MapLoadState = { phase: 'loading', since: 0 };
const listeners = new Set<(s: MapLoadState) => void>();
const setState = (s: MapLoadState) => {
  state = s;
  listeners.forEach((fn) => fn(s));
};
vi.mock('../map/MapService', () => ({
  mapService: {
    getLoadState: () => state,
    onLoadState: (fn: (s: MapLoadState) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  },
}));
const { MapLoading } = await import('./MapLoading');

beforeAll(() => initI18n('en'));
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('MapLoading (M5.1)', () => {
  it('shows nothing for a load shorter than the delay (no flicker)', () => {
    setState({ phase: 'loading', since: Date.now() });
    render(<MapLoading onRetry={() => {}} />);
    act(() => vi.advanceTimersByTime(150));
    act(() => setState({ phase: 'ready' }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByTestId('map-loading')).toBeNull();
  });

  it('shows a polite "Loading map…" status only after the delay, and hides it when ready', () => {
    setState({ phase: 'loading', since: Date.now() });
    render(<MapLoading onRetry={() => {}} />);
    expect(screen.queryByTestId('map-loading')).toBeNull();
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByTestId('map-loading')).toHaveTextContent('Loading map…');
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => setState({ phase: 'ready' }));
    expect(screen.queryByTestId('map-loading')).toBeNull();
  });

  it('shows an error with Retry at once on a real failure', () => {
    const retry = vi.fn();
    setState({ phase: 'error', reason: 'style' });
    render(<MapLoading onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The basemap could not be loaded.');
    fireEvent.click(screen.getByTestId('map-retry'));
    expect(retry).toHaveBeenCalledOnce();
  });
});
