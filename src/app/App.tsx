import { DirectionProvider } from '@radix-ui/react-direction';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useTranslation } from 'react-i18next';
import { dirOf } from '../i18n';
import { useWorkspace } from '../store/workspaceStore';
import { ConfirmHost } from '../ui/ConfirmDialog';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Workspace } from './Workspace';

/** Last resort if the workspace itself crashes (panels have their own boundaries). */
function AppCrashed() {
  const { t } = useTranslation();
  return (
    <div role="alert" style={{ padding: 32 }} data-testid="app-error">
      <p>{t('app.error')}</p>
      <p style={{ color: 'var(--text-dim)' }}>{t('app.errorHint')}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {t('app.reload')}
      </button>
    </div>
  );
}

export function App() {
  const language = useWorkspace((s) => s.settings.language);
  return (
    <DirectionProvider dir={dirOf(language)}>
      <Tooltip.Provider delayDuration={400}>
        <ErrorBoundary fallback={<AppCrashed />} scope="app">
          <Workspace />
          <ConfirmHost />
        </ErrorBoundary>
      </Tooltip.Provider>
    </DirectionProvider>
  );
}
