import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mapWidth } from '../layout/dockPlanner';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import styles from '../ui/ui.module.css';

/** Development-only: validates the Tool Registry and shows the numbers the dock invariants rely on. */
export function DebugPanel() {
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
      <p className={styles.hint}>{t('debug.note')}</p>
    </>
  );
}

export function SamplePanel() {
  const { t } = useTranslation();
  return <p className={styles.hint}>{t('sample.body')}</p>;
}
