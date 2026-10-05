import { Check, Map as MapIcon, Mountain, Satellite, Waves } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BasemapManager } from '../../map/BasemapManager';
import type { BasemapDefinition } from '../../map/types';
import { useWorkspace } from '../../store/workspaceStore';
import styles from './overlay.module.css';

const ICONS: Record<BasemapDefinition['icon'], typeof MapIcon> = {
  map: MapIcon,
  satellite: Satellite,
  mountain: Mountain,
  waves: Waves,
};

/** The list of basemaps as radio choices; used by the map picker and the Layers panel. */
export function BasemapOptions({ onPick, testIdPrefix = 'basemap-option' }: { onPick?: (e: MouseEvent) => void; testIdPrefix?: string }) {
  const { t } = useTranslation();
  const basemapId = useWorkspace((s) => s.basemapId);
  const setBasemap = useWorkspace((s) => s.setBasemap);
  const current = BasemapManager.resolve(basemapId);
  return (
    <div role="radiogroup" aria-label={t('basemap.picker')} className={styles.options}>
      {BasemapManager.list().map((b) => {
        const Icon = ICONS[b.icon];
        const selected = b.id === current.id;
        return (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={styles.option}
            data-testid={`${testIdPrefix}-${b.id}`}
            onClick={(e) => {
              setBasemap(b.id);
              onPick?.(e);
            }}
          >
            <span className={`${styles.swatch} ${styles[`swatch_${b.icon}`] ?? ''}`} aria-hidden>
              <Icon size={18} />
            </span>
            <span className={styles.optionName}>{t(b.nameKey)}</span>
            {selected && <Check size={14} className={styles.check} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
