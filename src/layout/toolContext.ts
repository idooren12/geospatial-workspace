import { mapService } from '../map/MapService';
import { persistence } from '../persistence';
import { useWorkspace } from '../store/workspaceStore';
import type { ToolContext } from '../tools/types';

const cache = new Map<string, ToolContext>();

/** The narrow API a tool gets (spec §8, MAP-03). One stable object per tool. */
export function toolContext(toolId: string): ToolContext {
  let ctx = cache.get(toolId);
  if (ctx) return ctx;
  ctx = {
    toolId,
    map: {
      flyTo: (o) => mapService.flyTo(o),
      fitBounds: (b, o) => mapService.fitBounds(b, o),
      getView: () => mapService.getView(),
    },
    layers: {
      add: (layer) => useWorkspace.getState().addLayer({ ...layer, ownerToolId: toolId }),
      update: (id, patch) => useWorkspace.getState().updateLayer(id, patch),
      remove: (id) => {
        const s = useWorkspace.getState();
        s.removeLayer(id, { force: s.layers[id]?.ownerToolId === toolId });
      },
      own: () => {
        const s = useWorkspace.getState();
        return s.layerOrder.map((id) => s.layers[id]!).filter((l) => l.ownerToolId === toolId);
      },
    },
    dock: {
      close: () => useWorkspace.getState().closePanel(toolId),
      focus: () => useWorkspace.getState().openPanel(toolId),
    },
    storage: persistence.toolStorage(toolId),
  };
  cache.set(toolId, ctx);
  return ctx;
}
