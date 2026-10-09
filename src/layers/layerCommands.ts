import i18n from '../i18n';
import { history } from '../history/history';
import { useWorkspace } from '../store/workspaceStore';

const get = () => useWorkspace.getState();

/**
 * User edits to workspace layers, recorded for undo. Panels call these instead of the store's
 * raw setters; tools adding their own layers keep using ToolContext (not user edits).
 */
export const layerCommands = {
  /** Removes a layer (the caller confirms first for layers with content). Undo restores it in place. */
  remove(id: string): void {
    const layer = get().layers[id];
    if (!layer || !layer.removable) return;
    const index = get().layerOrder.indexOf(id);
    history.run(
      {
        label: i18n.t('history.deleteLayer', { name: layer.name }),
        redo: () => get().removeLayer(id),
        undo: () => get().restoreLayer(layer, index),
      },
      { toast: true },
    );
  },

  rename(id: string, name: string): void {
    const before = get().layers[id]?.name;
    const after = name.trim();
    if (before === undefined || !after || after === before) return;
    history.run({
      label: i18n.t('history.rename', { name: after }),
      redo: () => get().renameLayer(id, after),
      undo: () => get().renameLayer(id, before),
    });
  },

  setVisible(id: string, visible: boolean): void {
    const layer = get().layers[id];
    if (!layer || layer.visible === visible) return;
    history.run({
      label: i18n.t(visible ? 'history.show' : 'history.hide', { name: layer.name }),
      redo: () => get().setLayerVisible(id, visible),
      undo: () => get().setLayerVisible(id, !visible),
    });
  },

  /** Moves a layer to an index of the stack (0 = bottom). */
  move(id: string, toIndex: number): void {
    const from = get().layerOrder.indexOf(id);
    const layer = get().layers[id];
    if (from < 0 || !layer || from === toIndex) return;
    history.run({
      label: i18n.t('history.move', { name: layer.name }),
      redo: () => get().moveLayer(id, toIndex),
      undo: () => get().moveLayer(id, from),
    });
  },
};
