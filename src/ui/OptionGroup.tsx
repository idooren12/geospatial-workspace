import type { ReactNode } from 'react';
import styles from './ui.module.css';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
}

interface OptionGroupProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** Compact side-by-side buttons instead of a vertical list. */
  segmented?: boolean;
  testId?: string;
}

/** A labelled single-choice control (radio semantics, button looks). */
export function OptionGroup<T extends string>({ label, value, options, onChange, segmented, testId }: OptionGroupProps<T>) {
  return (
    <fieldset className={styles.fieldset} data-testid={testId}>
      <legend className={styles.legend}>{label}</legend>
      <div role="radiogroup" aria-label={label} className={segmented ? styles.segmented : styles.list}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={styles.choice}
            onClick={() => onChange(o.value)}
            data-value={o.value}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}
