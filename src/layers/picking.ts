import { drawController } from '../map/draw/DrawController';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import { MEASURE_SOURCE } from '../utilities/measure/measurementOverlay';

/** Panel ids of the built-in panels that reveal clicked items. */
const LAYERS_PANEL = 'layers';
const MEASURE_PANEL = 'measure';

type Hit = { kind: 'layer'; id: string; featureId?: string } | { kind: 'measurement'; id: string };

function hitAt(point: { x: number; y: number }): Hit | null {
  for (const f of mapService.queryWorkspaceFeatures(point)) {
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

let wired = false;

/**
 * Clicking a workspace feature opens the panel that lists it and reveals it there (owner request).
 * Inactive while a drawing tool is in use, so drawing on top of existing shapes still works.
 */
export function wirePicking(): void {
  if (wired) return;
  wired = true;
  let pointer = false;
  mapService.on('mousemove', (e) => {
    if (drawController.getState().tool !== 'none') return;
    const over = hitAt(e.point) !== null;
    if (over !== pointer) {
      pointer = over;
      mapService.setCursor(over ? 'pointer' : '');
    }
  });
  mapService.on('click', (e) => {
    if (drawController.getState().tool !== 'none') return;
    const hit = hitAt(e.point);
    if (!hit) return;
    const s = useWorkspace.getState();
    s.openPanel(hit.kind === 'layer' ? LAYERS_PANEL : MEASURE_PANEL);
    s.reveal(hit.kind, hit.id, hit.kind === 'layer' ? hit.featureId : undefined);
  });
}
