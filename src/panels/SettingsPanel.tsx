import { HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { history } from '../history/history';
import { persistence } from '../persistence';
import { useWorkspace } from '../store/workspaceStore';
import { confirmAction } from '../ui/confirm';
import { OptionGroup, Section } from '../ui/OptionGroup';
import styles from '../ui/ui.module.css';

export function SettingsPanel() {
  const { t } = useTranslation();
  const settings = useWorkspace((s) => s.settings);
  const update = useWorkspace((s) => s.updateSettings);
  const reset = useWorkspace((s) => s.resetWorkspace);

  // Removes everything at once and cannot be undone, so it is confirmed in a dialog first.
  const askReset = async () => {
    const ok = await confirmAction({
      title: t('confirm.resetTitle'),
      description: t('confirm.resetBody'),
      confirmLabel: t('confirm.reset'),
      cancelLabel: t('confirm.cancel'),
      danger: true,
    });
    if (!ok) return;
    reset();
    history.clear();
  };

  return (
    <>
      <OptionGroup
        label={t('settings.language')}
        value={settings.language}
        segmented
        onChange={(language) => update({ language })}
        options={[
          { value: 'he', label: <span lang="he">עברית</span> },
          { value: 'en', label: <span lang="en">English</span> },
        ]}
        testId="settings-language"
      />
      <OptionGroup
        label={t('settings.units')}
        value={settings.units}
        onChange={(units) => update({ units })}
        options={[
          { value: 'metric', label: t('settings.metric') },
          { value: 'nautical', label: t('settings.nautical') },
          { value: 'imperial', label: t('settings.imperial') },
        ]}
        testId="settings-units"
      />
      <OptionGroup
        label={t('settings.coords')}
        value={settings.coordFormat}
        onChange={(coordFormat) => update({ coordFormat })}
        options={[
          { value: 'decimal', label: t('settings.decimal') },
          { value: 'dms', label: t('settings.dms') },
        ]}
        testId="settings-coords"
      />
      <Section title={t('settings.storage')}>
        <p className={styles.hint} data-testid="settings-storage">
          <HardDrive size={12} aria-hidden /> {t(`settings.storage_${persistence.geometryBackend}`)}
        </p>
      </Section>
      <Section title={t('settings.reset')}>
        <button type="button" className={styles.dangerBtn} onClick={() => void askReset()} data-testid="settings-reset">
          {t('settings.reset')}
        </button>
        <p className={styles.hint}>{t('settings.resetHint')}</p>
      </Section>
    </>
  );
}
