import { drawController } from '../map/draw/DrawController';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import { MEASURE_SOURCE } from '../utilities/measure/measurementOverlay';
import { SELECTION_SOURCE } from './selectionOverlay';

/** Panel ids of the built-in panels that reveal clicked items. */
const LAYERS_PANEL = 'layers';
const MEASURE_PANEL = 'measure';

type Hit = { kind: 'layer'; id: string; featureId?: string } | { kind: 'measurement'; id: string };

function hitAt(point: { x: number; y: number }): Hit | null {
  for (const f of mapService.queryWorkspaceFeatures(point)) {
    if (f.mapLayerId.startsWith(`${SELECTION_SOURCE}:`)) continue; // the highlight itself
    if (f.mapLayerId.startsWith(`${MEASURE_SOURCE}:`)) {
      const mid = f.properties.mid;
      if (typeof mid === 'string') return { kind: 'measurement', id: mid };
      continue;
    }
    const m = /^ws:(.+):\d+$/.exec(f.mapLayerId); // workspace layer: ws:<layerId>:<n>
    if (m && useWorkspace.getState().layers[m[1]!]) {
      const fid = f.properties.fid;
      return { kind: 'layer', id: m[1]!, ...(typeof fid === 'string' ? { featureId: fid } : {}) };
    }
  }
  return null;
}

let unwire: (() => void) | null = null;

/**
 * Clicking a workspace feature selects it, opens the panel that lists it and reveals it there
 * (owner request). Clicking empty map clears the selection. Inactive while a drawing tool is in
 * use, so drawing on top of existing shapes still works.
 */
export function wirePicking(): () => void {
  if (unwire) return unwire; // idempotent: StrictMode re-runs must not double the handlers
  let pointer = false;
  const offMove = mapService.on('mousemove', (e) => {
    if (drawController.getState().tool !== 'none') return;
    const over = hitAt(e.point) !== null;
    if (over !== pointer) {
      pointer = over;
      mapService.setCursor(over ? 'pointer' : '');
    }
  });
  const offClick = mapService.on('click', (e) => {
    if (drawController.getState().tool !== 'none') return;
    const hit = hitAt(e.point);
    const s = useWorkspace.getState();
    if (!hit) {
      if (s.selection) s.select(null);
      return;
    }
    if (hit.kind === 'measurement') s.select({ kind: 'measurement', id: hit.id });
    else s.select(hit.featureId ? { kind: 'feature', layerId: hit.id, featureId: hit.featureId } : { kind: 'layer', layerId: hit.id });
    s.openPanel(hit.kind === 'layer' ? LAYERS_PANEL : MEASURE_PANEL);
    s.reveal(hit.kind, hit.id, hit.kind === 'layer' ? hit.featureId : undefined);
  });
  unwire = () => {
    offMove();
    offClick();
    unwire = null;
  };
  return unwire;
}
