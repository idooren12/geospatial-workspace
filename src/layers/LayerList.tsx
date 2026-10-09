import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, GripVertical, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../store/workspaceStore';
import { toolRegistry } from '../tools/ToolRegistry';
import { confirmAction } from '../ui/confirm';
import { useReveal } from '../ui/useReveal';
import { layerCommands } from './layerCommands';
import { inlineFeatureCount, type WorkspaceLayer } from './layerTypes';
import i18n from '../i18n';
import styles from './LayerList.module.css';

/**
 * The workspace layer list (spec §7.1–7.2), top layer first. Drag the handle — or focus it and use
 * Space + arrow keys — to reorder; the menu offers the same moves for anyone who prefers it.
 */
export function LayerList() {
  const { t } = useTranslation();
  const order = useWorkspace((s) => s.layerOrder);
  const display = [...order].reverse(); // top of the map first
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const displayIndex = display.indexOf(String(over.id));
    layerCommands.move(String(active.id), order.length - 1 - displayIndex);
  };

  if (order.length === 0) return null;
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={display} strategy={verticalListSortingStrategy}>
          <ul className={styles.list} data-testid="layer-list">
            {display.map((id, i) => (
              <LayerRow key={id} id={id} isTop={i === 0} isBottom={i === display.length - 1} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className={styles.hint}>{t('layers.topHint')}</p>
    </>
  );
}

function LayerRow({ id, isTop, isBottom }: { id: string; isTop: boolean; isBottom: boolean }) {
  const { t } = useTranslation();
  const layer = useWorkspace((s) => s.layers[id]);
  const order = useWorkspace((s) => s.layerOrder);
  const setLayerOpacity = useWorkspace((s) => s.setLayerOpacity);
  const selected = useWorkspace((s) => s.selection?.kind === 'layer' && s.selection.layerId === id);
  const select = useWorkspace((s) => s.select);
  const [editing, setEditing] = useState(false);
  // Opened by the panel itself when it mounts because of a reveal request.
  const [open, setOpen] = useState(() => {
    const f = useWorkspace.getState().focus;
    return f?.kind === 'layer' && f.id === id;
  });
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id });
  // A click on this layer's feature on the map (picking.ts) reveals the row: expand, scroll, flash.
  const focusSeq = useWorkspace((s) => (s.focus?.kind === 'layer' && s.focus.id === id ? s.focus.seq : undefined));
  const rowRef = useReveal(focusSeq !== undefined, focusSeq);
  const [seenSeq, setSeenSeq] = useState(focusSeq);
  if (focusSeq !== seenSeq) {
    // Adjust state while rendering (React's pattern for reacting to a changed input).
    setSeenSeq(focusSeq);
    if (focusSeq !== undefined) setOpen(true);
  }
  if (!layer) return null;

  const index = order.indexOf(id);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const startRename = () => setEditing(true);
  const onRowKey = (e: KeyboardEvent) => {
    if (e.key === 'F2' && !editing) {
      e.preventDefault();
      startRename();
    }
  };

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        rowRef.current = el;
      }}
      style={style}
      className={styles.row}
      data-dragging={isDragging}
      data-hidden={!layer.visible}
      data-selected={selected}
      aria-current={selected || undefined}
      data-testid={`layer-row-${id}`}
      onKeyDown={onRowKey}
    >
      <div
        className={styles.main}
        onClick={(e) => {
          // A click on the row (not on one of its buttons) selects the layer and highlights it.
          if (!(e.target as HTMLElement).closest('button, input')) select(selected ? null : { kind: 'layer', layerId: id });
        }}
      >
        <button
          type="button"
          className={styles.handle}
          aria-label={t('layers.drag', { name: layer.name })}
          title={t('layers.drag', { name: layer.name })}
          {...attributes}
          {...listeners}
          data-testid="layer-handle"
        >
          <GripVertical size={14} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.icon}
          aria-label={t(layer.visible ? 'layers.hide' : 'layers.show', { name: layer.name })}
          title={t(layer.visible ? 'layers.hide' : 'layers.show', { name: layer.name })}
          aria-pressed={layer.visible}
          onClick={() => layerCommands.setVisible(id, !layer.visible)}
          data-testid="layer-visibility"
        >
          {layer.visible ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
        </button>
        {editing ? (
          <RenameInput
            initial={layer.name}
            onDone={(name) => {
              if (name !== null) layerCommands.rename(id, name);
              setEditing(false);
            }}
          />
        ) : (
          <span
            className={styles.name}
            onDoubleClick={startRename}
            title={layer.name}
            tabIndex={0}
            role="button"
            aria-pressed={selected}
            aria-label={t('layers.select', { name: layer.name })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select(selected ? null : { kind: 'layer', layerId: id });
              }
            }}
            data-testid="layer-name"
          >
            <bdi>{layer.name}</bdi>
          </span>
        )}
        <button
          type="button"
          className={styles.icon}
          aria-expanded={open}
          aria-label={t('layers.details', { name: layer.name })}
          title={t('layers.details', { name: layer.name })}
          onClick={() => setOpen(!open)}
          data-testid="layer-expand"
        >
          <ChevronDown size={14} aria-hidden className={open ? styles.flip : ''} />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={styles.icon}
              aria-label={t('layers.menu', { name: layer.name })}
              title={t('layers.menu', { name: layer.name })}
              data-testid="layer-menu"
            >
              <MoreVertical size={14} aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menu} align="end" sideOffset={4}>
              <DropdownMenu.Item className={styles.menuItem} onSelect={startRename} data-testid="layer-rename">
                <Pencil size={14} aria-hidden /> {t('layers.rename')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={styles.menuItem}
                disabled={isTop}
                onSelect={() => layerCommands.move(id, index + 1)}
                data-testid="layer-up"
              >
                <ArrowUp size={14} aria-hidden /> {t('layers.moveUp')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={styles.menuItem}
                disabled={isBottom}
                onSelect={() => layerCommands.move(id, index - 1)}
                data-testid="layer-down"
              >
                <ArrowDown size={14} aria-hidden /> {t('layers.moveDown')}
              </DropdownMenu.Item>
              {layer.removable && (
                <>
                  <DropdownMenu.Separator className={styles.sep} />
                  <DropdownMenu.Item
                    className={`${styles.menuItem} ${styles.danger}`}
                    onSelect={() => void removeWithConfirm(layer)}
                    data-testid="layer-remove"
                  >
                    <Trash2 size={14} aria-hidden /> {t('layers.remove')}
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      {open && <LayerDetails layer={layer} onOpacity={(o) => setLayerOpacity(id, o)} />}
    </li>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      ref={ref}
      className={styles.input}
      defaultValue={initial}
      aria-label={t('layers.nameInput')}
      dir="auto"
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value);
        if (e.key === 'Escape') {
          e.preventDefault(); // don't also leave Map Only
          finish(null);
        }
        e.stopPropagation(); // keep F2/arrows from reaching the row or the drag sensor
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      data-testid="layer-name-input"
    />
  );
}

/**
 * Removing a layer that holds features removes them all, so it is confirmed first (with what goes);
 * an empty layer goes at once. Either way Undo brings it back.
 */
async function removeWithConfirm(layer: WorkspaceLayer): Promise<void> {
  const t = i18n.t.bind(i18n);
  const count = inlineFeatureCount(layer);
  if (count) {
    const ok = await confirmAction({
      title: t('confirm.deleteLayerTitle', { name: layer.name }),
      description: count === 1 ? t('confirm.deleteLayerOne') : t('confirm.deleteLayerBody', { count }),
      hint: t('confirm.undoHint'),
      confirmLabel: t('confirm.delete'),
      cancelLabel: t('confirm.cancel'),
      danger: true,
    });
    if (!ok) return;
  }
  layerCommands.remove(layer.id);
}

function LayerDetails({ layer, onOpacity }: { layer: WorkspaceLayer; onOpacity: (o: number) => void }) {
  const { t } = useTranslation();
  const owner = layer.ownerToolId ? toolRegistry.get(layer.ownerToolId) : undefined;
  const Extra = owner?.layerDetails;
  const pct = Math.round(layer.opacity * 100);
  return (
    <div className={styles.details}>
      <label className={styles.opacity}>
        <span>{t('layers.opacity')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => onOpacity(Number(e.currentTarget.value) / 100)}
          data-testid="layer-opacity"
        />
        <span className="num">{pct}%</span>
      </label>
      <dl className={styles.meta}>
        <dt>{t('layers.typeLabel')}</dt>
        <dd>{t(`layers.type_${layer.type}`)}</dd>
        {layer.group && !Extra && (
          <>
            <dt>{t('layers.group')}</dt>
            <dd>
              <bdi>{layer.group}</bdi>
            </dd>
          </>
        )}
        {layer.ownerToolId && (
          <>
            <dt>{t('layers.owner')}</dt>
            <dd>{owner?.nameKey ? t(owner.nameKey) : (owner?.name ?? layer.ownerToolId)}</dd>
          </>
        )}
      </dl>
      {Extra && <Extra layer={layer} />}
    </div>
  );
}
