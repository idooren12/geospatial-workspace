import type { ComponentType, ReactNode } from 'react';
import type { FitBoundsOptions, FlyToOptions, LngLatBoundsLike, MapViewState } from '../map/types';

/**
 * A tool is a plug-in module: a panel component plus how it docks. The workspace discovers tools
 * through the registry and never names one in its own code (spec §8).
 */
export interface ToolDefinition {
  id: string;
  /** Display name. Built-in tools give an i18n key instead. */
  name: string;
  nameKey?: string;
  icon: ReactNode;
  defaultDock: 'left' | 'right';
  component: ComponentType<ToolPanelProps>;
  /** Position on its rail, ascending. */
  order?: number;
  /** Show a button on the map-edge rail (default true). Built-ins opened elsewhere set false. */
  rail?: boolean;
  /** Registered only in development builds. */
  devOnly?: boolean;
}

export interface ToolPanelProps {
  ctx: ToolContext;
}

/**
 * Everything a tool may touch. Deliberately small: no raw map, no store internals (MAP-03).
 * Layer operations join in M3 together with the LayerManager.
 */
export interface ToolContext {
  toolId: string;
  map: {
    flyTo(options: FlyToOptions): void;
    fitBounds(bounds: LngLatBoundsLike, options?: FitBoundsOptions): void;
    getView(): MapViewState | null;
  };
  dock: {
    close(): void;
    focus(): void;
  };
  /** LocalStorage namespaced to this tool. */
  storage: {
    get<T>(key: string): T | null;
    set(key: string, value: unknown): void;
    remove(key: string): void;
  };
}
