import * as Tooltip from '@radix-ui/react-tooltip';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../store/workspaceStore';
import { findPanel, type DockSide } from './dockPlanner';
import { useToolName, useTools } from './useTools';
import styles from './dock.module.css';

/**
 * A thin floating toolbar on one edge of the map, built from the Tool Registry. It sits on the
 * map's edge, so with panels open it follows the map, right beside the dock.
 */
export function Rail({ side }: { side: DockSide }) {
  const { t } = useTranslation();
  const tools = useTools().filter((tool) => tool.defaultDock === side);
  const nameOf = useToolName();
  const dock = useWorkspace((s) => s.dock);
  const toggle = useWorkspace((s) => s.togglePanel);
  const rtl = useWorkspace((s) => s.settings.language) === 'he';
  if (tools.length === 0 || dock.mapOnly) return null;

  // Tooltips point into the map, away from the edge.
  const inward = (side === 'left') !== rtl ? 'right' : 'left';
  return (
    <nav
      className={styles.rail}
      data-side={side}
      aria-label={t(side === 'left' ? 'rail.left' : 'rail.right')}
      data-testid={`rail-${side}`}
    >
      {tools.map((tool) => {
        const at = findPanel(dock, tool.id);
        const showing = !!at && at.column.activePanelId === tool.id;
        const name = nameOf(tool, tool.id);
        return (
          <Tooltip.Root key={tool.id}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className={styles.railBtn}
                aria-label={name}
                aria-pressed={showing}
                data-open={!!at}
                onClick={() => toggle(tool.id)}
                data-testid={`rail-btn-${tool.id}`}
              >
                {tool.icon}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip" side={inward} sideOffset={8}>
                {name}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </nav>
  );
}
