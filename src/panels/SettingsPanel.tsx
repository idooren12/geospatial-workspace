import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clearWorkspace } from '../store/persistence';
import { useWorkspace } from '../store/workspaceStore';
import { OptionGroup, Section } from '../ui/OptionGroup';
import styles from '../ui/ui.module.css';

export function SettingsPanel() {
  const { t } = useTranslation();
  const settings = useWorkspace((s) => s.settings);
  const update = useWorkspace((s) => s.updateSettings);
  const reset = useWorkspace((s) => s.resetWorkspace);
  const [armed, setArmed] = useState(false);

  // A reset needs a second click within a few seconds; no browser confirm dialogs.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

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
      <Section title={t('settings.reset')}>
        <button
          type="button"
          className={styles.dangerBtn}
          data-armed={armed}
          onClick={() => {
            if (!armed) return setArmed(true);
            clearWorkspace();
            reset();
            setArmed(false);
          }}
          data-testid="settings-reset"
        >
          {armed ? t('settings.resetConfirm') : t('settings.reset')}
        </button>
        <p className={styles.hint}>{t('settings.resetHint')}</p>
      </Section>
    </>
  );
}
