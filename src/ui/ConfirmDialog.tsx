import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useSyncExternalStore } from 'react';
import styles from './ConfirmDialog.module.css';
import { closeConfirm as close, confirmStore, takeReturnFocus } from './confirm';

/**
 * Renders the dialog. Radix AlertDialog traps focus, closes on Escape (as cancel), and returns
 * focus to where it was. The safe choice (Cancel) has initial focus.
 */
export function ConfirmHost() {
  const p = useSyncExternalStore(confirmStore.subscribe, confirmStore.get);
  return (
    <AlertDialog.Root open={!!p} onOpenChange={(open) => !open && close(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        {p && (
          <AlertDialog.Content
            className={styles.content}
            data-testid="confirm-dialog"
            onCloseAutoFocus={(e) => {
              const el = takeReturnFocus();
              if (el?.isConnected) {
                e.preventDefault();
                el.focus();
              }
            }}
          >
            <AlertDialog.Title className={styles.title}>{p.title}</AlertDialog.Title>
            <AlertDialog.Description className={styles.body}>{p.description}</AlertDialog.Description>
            {p.hint && <p className={styles.hint}>{p.hint}</p>}
            <div className={styles.actions}>
              <AlertDialog.Cancel className={styles.button} onClick={() => close(false)} data-testid="confirm-cancel">
                {p.cancelLabel}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={`${styles.button} ${p.danger ? styles.danger : styles.primary}`}
                onClick={() => close(true)}
                data-testid="confirm-ok"
              >
                {p.confirmLabel}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        )}
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
