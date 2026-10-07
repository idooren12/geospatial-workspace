import { Focus, Hexagon, MapPin, Plus, Spline, Trash2 } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { drawController, type DrawTool } from '../map/draw/DrawController';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import { EditableName } from '../ui/EditableName';
import { useReveal } from '../ui/useReveal';
import { Section } from '../ui/OptionGroup';
import ui from '../ui/ui.module.css';
import {
  createDrawingLayer,
  featuresOf,
  isDrawingLayer,
  removeDrawing,
  renameDrawing,
  type DrawingFeature,
} from '../utilities/draw/drawingLayers';
import { ToolButton } from './MeasurePanel';
import styles from './toolPanels.module.css';

const DRAW_TOOLS: DrawTool[] = ['point', 'line', 'polygon'];
const NEW = '__new__';

/**
 * Drawing (UTL-05) into named layers: pick a layer (or create one) and every shape drawn goes into
 * it, so a group of drawings is one layer. Shapes are named and labelled on the map.
 */
export function DrawPanel() {
  const { t } = useTranslation();
  const { tool } = useSyncExternalStore(drawController.subscribe, drawController.getState);
  const layers = useWorkspace((s) => s.layers);
  const order = useWorkspace((s) => s.layerOrder);
  const targetId = useWorkspace((s) => s.drawTargetId);
  const setTarget = useWorkspace((s) => s.setDrawTarget);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const drawingLayers = [...order].reverse().map((id) => layers[id]).filter(isDrawingLayer);
  const target = (targetId && isDrawingLayer(layers[targetId]) ? layers[targetId] : drawingLayers[0]) ?? null;
  const features = featuresOf(target ?? undefined);
  const suggested = t('draw.defaultLayer', { n: drawingLayers.length + 1 });

  useEffect(
    () => () => {
      if (DRAW_TOOLS.includes(drawController.getState().tool)) drawController.setTool('none');
    },
    [],
  );

  const create = () => {
    createDrawingLayer(newName.trim() || suggested);
    setNewName('');
    setCreating(false);
  };

  const hint =
    tool === 'point' ? t('measure.hintPoint') : tool === 'line' ? t('measure.hintLine') : tool === 'polygon' ? t('measure.hintPolygon') : null;

  return (
    <>
      <Section title={t('draw.layer')}>
        {drawingLayers.length > 0 && !creating ? (
          <select
            className={ui.select}
            value={target?.id ?? ''}
            aria-label={t('draw.layer')}
            onChange={(e) => {
              if (e.currentTarget.value === NEW) setCreating(true);
              else setTarget(e.currentTarget.value);
            }}
            data-testid="draw-target"
          >
            {drawingLayers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            <option value={NEW}>{t('draw.newLayerOption')}</option>
          </select>
        ) : (
          <div className={ui.inline}>
            <input
              value={newName}
              placeholder={suggested}
              aria-label={t('draw.newLayerName')}
              dir="auto"
              autoFocus={creating}
              onChange={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create();
                if (e.key === 'Escape' && drawingLayers.length > 0) {
                  e.preventDefault();
                  setCreating(false);
                }
              }}
              data-testid="draw-new-name"
            />
            <button type="button" className={ui.primaryBtn} onClick={create} data-testid="draw-new-create">
              <Plus size={14} aria-hidden /> {t('draw.create')}
            </button>
          </div>
        )}
        <p className={ui.hint}>{drawingLayers.length === 0 ? t('draw.firstHint') : t('draw.targetHint')}</p>
      </Section>

      <Section title={t('measure.draw')}>
        <div className={styles.tools}>
          <ToolButton id="point" icon={<MapPin size={16} aria-hidden />} label={t('measure.point')} active={tool} />
          <ToolButton id="line" icon={<Spline size={16} aria-hidden />} label={t('measure.line')} active={tool} />
          <ToolButton id="polygon" icon={<Hexagon size={16} aria-hidden />} label={t('measure.polygon')} active={tool} />
        </div>
      </Section>

      {target && (
        <Section title={t('draw.inLayer', { name: target.name })}>
          {features.length === 0 ? (
            <p className={ui.empty} data-testid="drawings-empty">
              {t('draw.empty')}
            </p>
          ) : (
            <ul className={ui.items} data-testid="drawing-list">
              {[...features].reverse().map((f) => (
                <DrawingRow key={f.properties.fid} layerId={target.id} f={f} />
              ))}
            </ul>
          )}
        </Section>
      )}

      {hint && (
        <p className={styles.hint} role="status" data-testid="draw-hint">
          {hint}
        </p>
      )}
    </>
  );
}

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

function DrawingRow({ layerId, f }: { layerId: string; f: DrawingFeature }) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[f.properties.kind];
  const focus = useWorkspace((s) =>
    s.focus?.kind === 'layer' && s.focus.id === layerId && s.focus.featureId === f.properties.fid ? s.focus.seq : undefined,
  );
  const ref = useReveal(focus !== undefined, focus);
  const name = f.properties.name;
  return (
    <li ref={ref} className={ui.item} data-testid={`drawing-${f.properties.fid}`}>
      <Icon size={14} aria-hidden className={ui.itemValue} />
      <EditableName value={name} onRename={(n) => renameDrawing(layerId, f.properties.fid, n)} testId="drawing-name" />
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
        onClick={() => removeDrawing(layerId, f.properties.fid)}
        data-testid="drawing-remove"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}
