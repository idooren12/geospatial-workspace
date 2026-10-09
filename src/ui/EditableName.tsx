import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ui.module.css';

interface Props {
  value: string;
  onRename: (name: string) => void;
  testId?: string;
  /** Start editing from outside (e.g. a menu item). */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** Enter / Space on the name (e.g. select the item). Makes the name a toggle button. */
  onActivate?: () => void;
  activateLabel?: string;
  pressed?: boolean;
}

/** A name that turns into a text field on double click or F2; Enter saves, Escape cancels. */
export function EditableName({ value, onRename, testId, editing: forced, onEditingChange, onActivate, activateLabel, pressed }: Props) {
  const { t } = useTranslation();
  const [own, setOwn] = useState(false);
  const editing = forced ?? own;
  const setEditing = (v: boolean) => (onEditingChange ? onEditingChange(v) : setOwn(v));

  if (!editing) {
    return (
      <span
        className={styles.editable}
        title={value}
        tabIndex={0}
        {...(onActivate ? { role: 'button', 'aria-pressed': !!pressed, 'aria-label': activateLabel } : {})}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault();
            setEditing(true);
          } else if (onActivate && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onActivate();
          }
        }}
        data-testid={testId}
      >
        <bdi>{value}</bdi>
      </span>
    );
  }
  return (
    <NameInput
      initial={value}
      label={t('common.nameInput')}
      testId={testId ? `${testId}-input` : undefined}
      onDone={(name) => {
        if (name !== null && name.trim() && name.trim() !== value) onRename(name.trim());
        setEditing(false);
      }}
    />
  );
}

function NameInput({ initial, label, testId, onDone }: { initial: string; label: string; testId?: string; onDone: (n: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (n: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(n);
  };
  return (
    <input
      ref={ref}
      className={styles.nameInput}
      defaultValue={initial}
      aria-label={label}
      dir="auto"
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value);
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
        e.stopPropagation();
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      data-testid={testId}
    />
  );
}
