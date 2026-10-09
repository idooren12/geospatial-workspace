import { Undo2, X } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { history } from '../history/history';
import styles from './UndoToast.module.css';

const SHOW_MS = 8000;

/**
 * "Deleted “X” · Undo" after a single-item delete (those happen at once, without a dialog). Sits at
 * the top centre of the map, clear of the map controls and the attribution; announced politely.
 */
export function UndoToast() {
  const { t } = useTranslation();
  const toast = useSyncExternalStore(history.subscribe, () => history.getState().toast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => history.dismissToast(), SHOW_MS);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div className={styles.region} aria-live="polite">
      {toast && (
        <div className={styles.toast} data-testid="undo-toast">
          <span className={styles.label}>
            <bdi>{toast.label}</bdi>
          </span>
          <button type="button" className={styles.undo} onClick={() => history.undoToast(toast.id)} data-testid="undo-toast-undo">
            <Undo2 size={14} aria-hidden className="mirror-rtl" /> {t('history.toastUndo')}
          </button>
          <button
            type="button"
            className={styles.close}
            aria-label={t('history.dismiss')}
            title={t('history.dismiss')}
            onClick={() => history.dismissToast()}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
