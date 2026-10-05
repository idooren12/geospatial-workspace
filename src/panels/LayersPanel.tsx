import { useTranslation } from 'react-i18next';
import { BasemapOptions } from '../layout/overlay/BasemapOptions';
import { LayerList } from '../layers/LayerList';
import { BasemapManager } from '../map/BasemapManager';
import { useWorkspace } from '../store/workspaceStore';
import { OptionGroup, Section } from '../ui/OptionGroup';
import styles from '../ui/ui.module.css';

/**
 * Layers panel (spec §7.2): basemap choice, then the workspace layers tools have added.
 */
export function LayersPanel() {
  const { t } = useTranslation();
  const basemapId = useWorkspace((s) => s.basemapId);
  const theme = useWorkspace((s) => s.mapTheme);
  const setMapTheme = useWorkspace((s) => s.setMapTheme);
  const themed = BasemapManager.hasThemes(BasemapManager.resolve(basemapId));
  const hasLayers = useWorkspace((s) => s.layerOrder.length > 0);

  return (
    <>
      <Section title={t('layers.basemap')}>
        <BasemapOptions testIdPrefix="layers-basemap" />
        {themed && (
          <div style={{ marginBlockStart: 10 }}>
            <OptionGroup
              label={t('layers.theme')}
              value={theme}
              segmented
              onChange={setMapTheme}
              options={[
                { value: 'light', label: t('layers.light') },
                { value: 'dark', label: t('layers.dark') },
              ]}
            />
          </div>
        )}
      </Section>
      <Section title={t('layers.layers')}>
        {hasLayers ? (
          <LayerList />
        ) : (
          <p className={styles.empty} data-testid="layers-empty">
            {t('layers.empty')}
          </p>
        )}
      </Section>
    </>
  );
}
