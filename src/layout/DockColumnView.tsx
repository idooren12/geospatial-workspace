import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AlertTriangle, ArrowLeftRight, Columns2, MoreVertical, X } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../store/workspaceStore';
import { toolRegistry } from '../tools/ToolRegistry';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { canSplit, type DockColumn as Column } from './dockPlanner';
import { toolContext } from './toolContext';
import { useToolName, useTools } from './useTools';
import styles from './dock.module.css';

/** One dock column: a header (title or tab strip) and its panels. Inactive tabs stay mounted. */
export function DockColumnView({ column }: { column: Column }) {
  const { t } = useTranslation();
  useTools();
  const nameOf = useToolName();
  const activate = useWorkspace((s) => s.activatePanel);
  const close = useWorkspace((s) => s.closePanel);
  const tabbed = column.panelIds.length > 1;
  const activeName = nameOf(toolRegistry.get(column.activePanelId), column.activePanelId);

  return (
    <section className={styles.column} aria-label={activeName} data-testid="dock-column" data-panels={column.panelIds.join(' ')}>
      <header className={styles.header}>
        {tabbed ? (
          <div role="tablist" className={styles.tabs}>
            {column.panelIds.map((id) => {
              const name = nameOf(toolRegistry.get(id), id);
              const selected = id === column.activePanelId;
              return (
                <div key={id} className={styles.tab} data-selected={selected}>
                  <button
                    type="button"
                    role="tab"
                    id={`tab-${id}`}
                    aria-selected={selected}
                    aria-controls={`panel-${id}`}
                    className={styles.tabLabel}
                    onClick={() => activate(id)}
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    className={styles.tabClose}
                    aria-label={t('dock.close', { name })}
                    title={t('dock.close', { name })}
                    onClick={() => close(id)}
                  >
                    <X size={12} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <h2 className={styles.title}>{activeName}</h2>
        )}
        <div className={styles.headerActions}>
          <PanelMenu panelId={column.activePanelId} name={activeName} />
          {!tabbed && (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t('dock.close', { name: activeName })}
              title={t('dock.close', { name: activeName })}
              onClick={() => close(column.activePanelId)}
              data-testid="panel-close"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      </header>
      <div className={styles.body}>
        {column.panelIds.map((id) => (
          <PanelHost key={id} panelId={id} active={id === column.activePanelId} tabbed={tabbed} />
        ))}
      </div>
    </section>
  );
}

function PanelHost({ panelId, active, tabbed }: { panelId: string; active: boolean; tabbed: boolean }) {
  const { t } = useTranslation();
  const tool = toolRegistry.get(panelId);
  if (!tool) return null;
  const Panel = tool.component;
  return (
    <div
      id={`panel-${panelId}`}
      role={tabbed ? 'tabpanel' : undefined}
      aria-labelledby={tabbed ? `tab-${panelId}` : undefined}
      hidden={!active}
      className={styles.panel}
      data-testid={`panel-${panelId}`}
    >
      <ErrorBoundary
        fallback={
          <p className={styles.panelError}>
            <AlertTriangle size={14} aria-hidden /> {t('dock.error')}
          </p>
        }
      >
        <Suspense fallback={null}>
          <Panel ctx={toolContext(panelId)} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function PanelMenu({ panelId, name }: { panelId: string; name: string }) {
  const { t } = useTranslation();
  const splittable = useWorkspace((s) => canSplit(s.dock, panelId, s.bodyWidth));
  const move = useWorkspace((s) => s.movePanelToOtherSide);
  const split = useWorkspace((s) => s.splitPanel);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t('dock.menu', { name })}
          title={t('dock.menu', { name })}
          data-testid="panel-menu"
        >
          <MoreVertical size={14} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={4}>
          <DropdownMenu.Item className={styles.menuItem} onSelect={() => move(panelId)} data-testid="menu-move">
            <ArrowLeftRight size={14} aria-hidden /> {t('dock.moveToOther')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={styles.menuItem}
            disabled={!splittable}
            onSelect={() => split(panelId)}
            data-testid="menu-split"
          >
            <Columns2 size={14} aria-hidden /> {t('dock.split')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
