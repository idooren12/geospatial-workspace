import i18n from '../../i18n';
import { history } from '../../history/history';
import { useWorkspace } from '../../store/workspaceStore';
import type { MeasurementKind } from './types';

const get = () => useWorkspace.getState();

/** User edits to saved measurements, recorded for undo. */
export const measureCommands = {
  save(m: { name: string; kind: MeasurementKind; vertices: [number, number][] }): string {
    const id = get().saveMeasurement(m);
    const saved = get().measurements.find((x) => x.id === id)!;
    const index = get().measurements.indexOf(saved);
    history.push({
      label: i18n.t('history.saveMeasurement', { name: saved.name }),
      undo: () => get().removeMeasurement(id),
      redo: () => get().restoreMeasurement(saved, index),
    });
    return id;
  },

  /** Single item: deleted at once, with Undo offered in a toast. */
  remove(id: string): void {
    const list = get().measurements;
    const index = list.findIndex((m) => m.id === id);
    const m = list[index];
    if (!m) return;
    history.run(
      {
        label: i18n.t('history.deleteMeasurement', { name: m.name }),
        redo: () => get().removeMeasurement(id),
        undo: () => get().restoreMeasurement(m, index),
      },
      { toast: true },
    );
  },

  rename(id: string, name: string): void {
    const before = get().measurements.find((m) => m.id === id)?.name;
    const after = name.trim();
    if (before === undefined || !after || after === before) return;
    history.run({
      label: i18n.t('history.rename', { name: after }),
      redo: () => get().updateMeasurement(id, { name: after }),
      undo: () => get().updateMeasurement(id, { name: before }),
    });
  },

  setVisible(id: string, visible: boolean): void {
    const m = get().measurements.find((x) => x.id === id);
    if (!m || m.visible === visible) return;
    history.run({
      label: i18n.t(visible ? 'history.show' : 'history.hide', { name: m.name }),
      redo: () => get().updateMeasurement(id, { visible }),
      undo: () => get().updateMeasurement(id, { visible: !visible }),
    });
  },
};
