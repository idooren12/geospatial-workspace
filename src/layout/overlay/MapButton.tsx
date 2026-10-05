import * as Tooltip from '@radix-ui/react-tooltip';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './overlay.module.css';
import { useInwardSide } from './useInwardSide';

interface MapButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Says what the button DOES; used as aria-label and tooltip. */
  label: string;
  icon: ReactNode;
}

/** A square map control button in the MapLibre control style, with a tooltip. */
export const MapButton = forwardRef<HTMLButtonElement, MapButtonProps>(function MapButton(
  { label, icon, className, ...rest },
  ref,
) {
  const side = useInwardSide();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={[styles.button, className ?? ''].join(' ')}
          {...rest}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" side={side} sideOffset={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});
