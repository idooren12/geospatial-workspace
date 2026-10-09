import { describe, expect, it } from 'vitest';
import { createWorkspaceStore } from './workspaceStore';

const geo = { type: 'geojson' as const, data: { type: 'FeatureCollection', features: [] } };

describe('layers in the store', () => {
  it('adds on top, renames, hides, clamps opacity, reorders and removes', () => {
    const store = createWorkspaceStore();
    const s = () => store.getState();
    const a = s().addLayer({ name: 'A', type: 'geojson', source: geo });
    const b = s().addLayer({ name: ' B ', type: 'geojson', source: geo });
    expect(s().layerOrder).toEqual([a, b]);
    expect(s().layers[b]!.name).toBe('B');
    s().renameLayer(a, '   '); // blank names are ignored
    expect(s().layers[a]!.name).toBe('A');
    s().setLayerVisible(a, false);
    s().setLayerOpacity(a, 7);
    expect(s().layers[a]).toMatchObject({ visible: false, opacity: 1 });
    s().moveLayer(a, 1);
    expect(s().layerOrder).toEqual([b, a]);
    s().removeLayer(b);
    expect(s().layerOrder).toEqual([a]);
  });

  it('keeps non-removable layers unless a tool forces it', () => {
    const store = createWorkspaceStore();
    const id = store.getState().addLayer({ name: 'Locked', type: 'custom', removable: false });
    store.getState().removeLayer(id);
    expect(store.getState().layers[id]).toBeDefined();
    store.getState().removeLayer(id, { force: true });
    expect(store.getState().layers[id]).toBeUndefined();
  });

  it('restores a removed layer at its old position, and clears selection/target that pointed at it', () => {
    const store = createWorkspaceStore();
    const s = () => store.getState();
    const [a, b, c] = ['A', 'B', 'C'].map((name) => s().addLayer({ name, type: 'geojson', source: geo }));
    s().setDrawTarget(b!);
    s().select({ kind: 'layer', layerId: b! });
    const removed = s().layers[b!]!;
    s().removeLayer(b!);
    expect(s()).toMatchObject({ drawTargetId: null, selection: null });
    s().restoreLayer(removed, 1);
    expect(s().layerOrder).toEqual([a, b, c]);
  });

  it('keeps layer ids independent of names', () => {
    const store = createWorkspaceStore();
    const id = store.getState().addLayer({ name: 'Same', type: 'geojson', source: geo });
    const id2 = store.getState().addLayer({ name: 'Same', type: 'geojson', source: geo });
    expect(id).not.toBe(id2);
    store.getState().renameLayer(id, 'Other');
    expect(store.getState().layers[id]!.id).toBe(id);
  });
});
