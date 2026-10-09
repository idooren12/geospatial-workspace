import type { ComponentType, ReactNode } from 'react';
import type { FitBoundsOptions, FlyToOptions, LngLatBoundsLike, MapViewState } from '../map/types';
import type { NewWorkspaceLayer, WorkspaceLayer } from '../layers/layerTypes';

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
  /**
   * Extra content for the Layers panel's details of layers this tool owns (e.g. the shapes of a
   * drawing layer). Keeps the Layers panel generic: it never knows what a tool's layers contain.
   */
  layerDetails?: ComponentType<{ layer: WorkspaceLayer }>;
}

export interface ToolPanelProps {
  ctx: ToolContext;
}

/** Everything a tool may touch. Deliberately small: no raw map, no store internals (MAP-03). */
export interface ToolContext {
  toolId: string;
  map: {
    flyTo(options: FlyToOptions): void;
    fitBounds(bounds: LngLatBoundsLike, options?: FitBoundsOptions): void;
    getView(): MapViewState | null;
  };
  /**
   * Standard workspace layers (spec §7). Layers a tool adds are tagged with its id and stay when
   * the tool's panel closes (spec §8) unless the tool removes them.
   */
  layers: {
    /** Adds on top of the layer stack; returns the layer id. */
    add(layer: NewWorkspaceLayer): string;
    update(id: string, patch: Partial<Omit<WorkspaceLayer, 'id'>>): void;
    /** Removes a layer, including non-removable ones this tool created. */
    remove(id: string): void;
    /** Layers this tool created, bottom → top. */
    own(): WorkspaceLayer[];
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
