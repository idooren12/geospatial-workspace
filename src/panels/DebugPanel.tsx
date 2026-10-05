import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mapWidth } from '../layout/dockPlanner';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import type { ToolPanelProps } from '../tools/types';
import styles from '../ui/ui.module.css';

/** A polygon, a line and points around Tel Aviv — enough to exercise every default style. */
const TEST_DATA = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: { name: 'area' }, geometry: { type: 'Polygon' as const, coordinates: [[[34.74, 32.04], [34.84, 32.04], [34.84, 32.12], [34.74, 32.12], [34.74, 32.04]]] } },
    { type: 'Feature' as const, properties: { name: 'route' }, geometry: { type: 'LineString' as const, coordinates: [[34.70, 31.98], [34.79, 32.08], [34.90, 32.16]] } },
    { type: 'Feature' as const, properties: { name: 'a' }, geometry: { type: 'Point' as const, coordinates: [34.78, 32.08] } },
    { type: 'Feature' as const, properties: { name: 'b' }, geometry: { type: 'Point' as const, coordinates: [34.81, 32.06] } },
  ],
};

/** Development-only: validates the Tool Registry and shows the numbers the dock invariants rely on. */
export function DebugPanel({ ctx }: ToolPanelProps) {
  const { t } = useTranslation();
  const bodyWidth = useWorkspace((s) => s.bodyWidth);
  const dock = useWorkspace((s) => s.dock);
  const [instances, setInstances] = useState(mapService.instanceCount);
  useEffect(() => {
    const id = setInterval(() => setInstances(mapService.instanceCount), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <dl className={styles.kv}>
        <dt>{t('debug.mapInstances')}</dt>
        <dd className="num" data-testid="debug-instances">{instances}</dd>
        <dt>{t('debug.bodyWidth')}</dt>
        <dd className="num">{bodyWidth}px</dd>
        <dt>{t('debug.mapWidth')}</dt>
        <dd className="num">{mapWidth(dock, bodyWidth)}px</dd>
      </dl>
      <div style={{ display: 'flex', gap: 6, marginBlockStart: 12 }}>
        <button
          type="button"
          className={styles.dangerBtn}
          onClick={() => {
            const n = ctx.layers.own().length + 1;
            ctx.layers.add({ name: `Test ${n}`, type: 'geojson', group: 'debug', source: { type: 'geojson', data: TEST_DATA } });
            ctx.map.fitBounds([[34.68, 31.96], [34.92, 32.18]], { padding: 40 });
          }}
          data-testid="debug-add-layer"
        >
          {t('debug.addTestLayer')}
        </button>
        <button
          type="button"
          className={styles.dangerBtn}
          onClick={() => ctx.layers.own().forEach((l) => ctx.layers.remove(l.id))}
          data-testid="debug-remove-layers"
        >
          {t('debug.removeTestLayers')}
        </button>
      </div>
      <p className={styles.hint}>{t('debug.note')}</p>
    </>
  );
}

export function SamplePanel() {
  const { t } = useTranslation();
  return <p className={styles.hint}>{t('sample.body')}</p>;
}
