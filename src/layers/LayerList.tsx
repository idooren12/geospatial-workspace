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
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, GripVertical, Hexagon, MapPin, MoreVertical, Pencil, Spline, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../store/workspaceStore';
import { toolRegistry } from '../tools/ToolRegistry';
import { EditableName } from '../ui/EditableName';
import { useReveal } from '../ui/useReveal';
import ui from '../ui/ui.module.css';
import { featuresOf, isDrawingLayer, removeDrawing, renameDrawing, type DrawingFeature } from '../utilities/draw/drawingLayers';
import type { WorkspaceLayer } from './layerTypes';
import styles from './LayerList.module.css';

/**
 * The workspace layer list (spec §7.1–7.2), top layer first. Drag the handle — or focus it and use
 * Space + arrow keys — to reorder; the menu offers the same moves for anyone who prefers it.
 */
export function LayerList() {
  const { t } = useTranslation();
  const order = useWorkspace((s) => s.layerOrder);
  const moveLayer = useWorkspace((s) => s.moveLayer);
  const display = [...order].reverse(); // top of the map first
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const displayIndex = display.indexOf(String(over.id));
    moveLayer(String(active.id), order.length - 1 - displayIndex);
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
  const { setLayerVisible, setLayerOpacity, renameLayer, removeLayer, moveLayer } = useWorkspace.getState();
  const [editing, setEditing] = useState(false);
  // Opened by the panel itself when it mounts because of a reveal request.
  const [open, setOpen] = useState(() => {
    const f = useWorkspace.getState().focus;
    return f?.kind === 'layer' && f.id === id;
  });
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id });
  // A click on this layer's feature on the map (picking.ts) reveals the row: expand, scroll, flash.
  const focusSeq = useWorkspace((s) => (s.focus?.kind === 'layer' && s.focus.id === id ? s.focus.seq : undefined));
  const focusFid = useWorkspace((s) => (s.focus?.kind === 'layer' && s.focus.id === id ? s.focus.featureId : undefined));
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
      data-testid={`layer-row-${id}`}
      onKeyDown={onRowKey}
    >
      <div className={styles.main}>
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
          onClick={() => setLayerVisible(id, !layer.visible)}
          data-testid="layer-visibility"
        >
          {layer.visible ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
        </button>
        {editing ? (
          <RenameInput
            initial={layer.name}
            onDone={(name) => {
              if (name !== null) renameLayer(id, name);
              setEditing(false);
            }}
          />
        ) : (
          <span className={styles.name} onDoubleClick={startRename} title={layer.name} data-testid="layer-name">
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
                onSelect={() => moveLayer(id, index + 1)}
                data-testid="layer-up"
              >
                <ArrowUp size={14} aria-hidden /> {t('layers.moveUp')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={styles.menuItem}
                disabled={isBottom}
                onSelect={() => moveLayer(id, index - 1)}
                data-testid="layer-down"
              >
                <ArrowDown size={14} aria-hidden /> {t('layers.moveDown')}
              </DropdownMenu.Item>
              {layer.removable && (
                <>
                  <DropdownMenu.Separator className={styles.sep} />
                  <DropdownMenu.Item
                    className={`${styles.menuItem} ${styles.danger}`}
                    onSelect={() => removeLayer(id)}
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
      {open && <LayerDetails layer={layer} focusFid={focusFid} focusSeq={focusSeq} onOpacity={(o) => setLayerOpacity(id, o)} />}
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

interface DetailsProps {
  layer: WorkspaceLayer;
  focusFid: string | undefined;
  focusSeq: number | undefined;
  onOpacity: (o: number) => void;
}

function LayerDetails({ layer, focusFid, focusSeq, onOpacity }: DetailsProps) {
  const { t } = useTranslation();
  const drawings = isDrawingLayer(layer) ? featuresOf(layer) : null;
  const owner = layer.ownerToolId ? toolRegistry.get(layer.ownerToolId) : undefined;
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
        {layer.group && (
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
      {drawings && (
        <div className={styles.drawings}>
          <div className={styles.subTitle}>
            {t('layers.drawings')} ({drawings.length})
          </div>
          <ul className={ui.items} data-testid="layer-drawings">
            {drawings.map((f) => (
              <DrawingItem
                key={f.properties.fid}
                layerId={layer.id}
                f={f}
                seq={focusFid === f.properties.fid ? focusSeq : undefined}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const KIND_ICON = { point: MapPin, line: Spline, polygon: Hexagon } as const;

function DrawingItem({ layerId, f, seq }: { layerId: string; f: DrawingFeature; seq: number | undefined }) {
  const { t } = useTranslation();
  const ref = useReveal(seq !== undefined, seq);
  const Icon = KIND_ICON[f.properties.kind];
  const name = f.properties.name;
  return (
    <li ref={ref} className={ui.item} data-testid={`layer-drawing-${f.properties.fid}`}>
      <Icon size={14} aria-hidden className={ui.itemValue} />
      <EditableName value={name} onRename={(n) => renameDrawing(layerId, f.properties.fid, n)} testId="layer-drawing-name" />
      <button
        type="button"
        className={ui.iconBtn}
        aria-label={t('common.delete', { name })}
        title={t('common.delete', { name })}
        onClick={() => removeDrawing(layerId, f.properties.fid)}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}
