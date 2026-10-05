import * as Popover from '@radix-ui/react-popover';
import { Layers, Moon, Sun } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BasemapManager } from '../../map/BasemapManager';
import { mapService } from '../../map/MapService';
import { useWorkspace } from '../../store/workspaceStore';
import { BasemapOptions } from './BasemapOptions';
import { MapButton } from './MapButton';
import { useInwardSide } from './useInwardSide';
import styles from './overlay.module.css';


/** Basemap picker and light/dark switch, rendered inside the map under the zoom controls. */
export function MapControls() {
  return createPortal(
    <div className={styles.group}>
      <BasemapPicker />
      <ThemeToggle />
    </div>,
    mapService.getControlSlot('tools'),
  );
}

function BasemapPicker() {
  const { t } = useTranslation();
  const side = useInwardSide();
  const [open, setOpen] = useState(false);
  // Returning focus to the trigger after a mouse pick would pop its tooltip; keyboard users keep it.
  const pickedWithPointer = useRef(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <MapButton
          label={t('basemap.picker')}
          icon={<Layers size={16} aria-hidden />}
          aria-expanded={open}
          aria-haspopup="dialog"
          data-testid="basemap-picker"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          side={side}
          align="start"
          sideOffset={8}
          onCloseAutoFocus={(e) => {
            if (pickedWithPointer.current) e.preventDefault();
            pickedWithPointer.current = false;
          }}
        >
          <div className={styles.popoverTitle}>{t('basemap.picker')}</div>
          <BasemapOptions
            onPick={(e) => {
              pickedWithPointer.current = e.detail > 0; // detail is 0 for keyboard activation
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Shows the icon of the theme it switches TO, and says so in its tooltip. */
function ThemeToggle() {
  const { t } = useTranslation();
  const basemapId = useWorkspace((s) => s.basemapId);
  const theme = useWorkspace((s) => s.mapTheme);
  const setMapTheme = useWorkspace((s) => s.setMapTheme);
  if (!BasemapManager.hasThemes(BasemapManager.resolve(basemapId))) return null;

  const toDark = theme === 'light';
  return (
    <MapButton
      label={t(toDark ? 'theme.toDark' : 'theme.toLight')}
      icon={toDark ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
      onClick={() => setMapTheme(toDark ? 'dark' : 'light')}
      data-testid="theme-toggle"
    />
  );
}
