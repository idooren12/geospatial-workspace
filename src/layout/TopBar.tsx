import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../store/workspaceStore';
import { IconButton } from '../ui/IconButton';
import styles from './TopBar.module.css';

export function TopBar() {
  const { t } = useTranslation();
  const language = useWorkspace((s) => s.settings.language);
  const updateSettings = useWorkspace((s) => s.updateSettings);

  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden />
        <span className={styles.name} lang="en">
          {t('app.name')}
        </span>
        <span className={styles.sep} aria-hidden>
          /
        </span>
        <span className={styles.workspace} title={t('app.workspace')}>
          {t('app.untitled')}
        </span>
      </div>
      <div className={styles.actions}>
        <IconButton
          label={t('topbar.switchLanguage')}
          icon={
            <>
              <Languages size={16} aria-hidden />
              <span className={styles.lang}>{t('topbar.languageShort')}</span>
            </>
          }
          onClick={() => updateSettings({ language: language === 'he' ? 'en' : 'he' })}
        />
      </div>
    </div>
  );
}
