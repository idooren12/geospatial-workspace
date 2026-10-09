import { Focus, Hexagon, MapPin, Spline, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceLayer } from '../layers/layerTypes';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import { EditableName } from '../ui/EditableName';
import { useReveal } from '../ui/useReveal';
import ui from '../ui/ui.module.css';
import { featuresOf, removeDrawing, renameDrawing, type DrawingFeature } from '../utilities/draw/drawingLayers';
import styles from './toolPanels.module.css';

const KIND_ICON = { point: MapPin, line: Spline, polygon: Hexagon } as const;

function featureBounds(f: DrawingFeature): [[number, number], [number, number]] | null {
  const pts: number[][] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') pts.push(c as number[]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk((f.geometry as { coordinates?: unknown }).coordinates);
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p[0]!);
  const ys = pts.map((p) => p[1]!);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

/**
 * The shapes of one drawing layer: select (highlights on the map, no camera move), rename, zoom
 * to, delete (immediate, with Undo). Used by the Draw panel and inside the Layers panel.
 */
export function DrawingList({ layer, testId, newestFirst }: { layer: WorkspaceLayer; testId: string; newestFirst?: boolean }) {
  const features = featuresOf(layer);
  const list = newestFirst ? [...features].reverse() : features;
  return (
    <ul className={ui.items} data-testid={testId}>
      {list.map((f) => (
        <DrawingRow key={f.properties.fid} layerId={layer.id} f={f} prefix={testId === 'drawing-list' ? 'drawing' : 'layer-drawing'} />
      ))}
    </ul>
  );
}

function DrawingRow({ layerId, f, prefix }: { layerId: string; f: DrawingFeature; prefix: string }) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[f.properties.kind];
  const fid = f.properties.fid;
  const focus = useWorkspace((s) =>
    s.focus?.kind === 'layer' && s.focus.id === layerId && s.focus.featureId === fid ? s.focus.seq : undefined,
  );
  const selected = useWorkspace((s) => s.selection?.kind === 'feature' && s.selection.layerId === layerId && s.selection.featureId === fid);
  const select = useWorkspace((s) => s.select);
  const ref = useReveal(focus !== undefined, focus);
  const name = f.properties.name;
  const toggle = () => select(selected ? null : { kind: 'feature', layerId, featureId: fid });
  return (
    <li
      ref={ref}
      className={ui.item}
      aria-current={selected || undefined}
      data-testid={`${prefix}-${fid}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button, input')) toggle();
      }}
    >
      <Icon size={14} aria-hidden className={ui.itemValue} />
      <EditableName
        value={name}
        onRename={(n) => renameDrawing(layerId, fid, n)}
        onActivate={toggle}
        activateLabel={t('common.select', { name })}
        pressed={selected}
        testId={`${prefix}-name`}
      />
      <button
        type="button"
        className={ui.iconBtn}
        aria-label={t('common.zoomTo', { name })}
        title={t('common.zoomTo', { name })}
        onClick={() => {
          const b = featureBounds(f);
          if (b) mapService.fitBounds(b, { padding: 80, maxZoom: 16 });
        }}
      >
        <Focus size={14} aria-hidden />
      </button>
      <button
        type="button"
        className={ui.iconBtn}
        aria-label={t('common.delete', { name })}
        title={t('common.delete', { name })}
        onClick={() => removeDrawing(layerId, fid)}
        data-testid={`${prefix}-remove`}
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}

/** Shown in the Layers panel under a drawing layer's details (ToolDefinition.layerDetails). */
export function DrawingLayerDetails({ layer }: { layer: WorkspaceLayer }) {
  const { t } = useTranslation();
  const count = featuresOf(layer).length;
  return (
    <div className={styles.layerDrawings}>
      <div className={styles.subTitle}>
        {t('layers.drawings')} ({count})
      </div>
      <DrawingList layer={layer} testId="layer-drawings" />
    </div>
  );
}
