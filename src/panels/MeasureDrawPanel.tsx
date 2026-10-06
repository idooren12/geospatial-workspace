import { Eraser, Hexagon, MapPin, Ruler, Spline, Square, Undo2 } from 'lucide-react';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { drawController, type DrawTool } from '../map/draw/DrawController';
import { useWorkspace } from '../store/workspaceStore';
import { clearSketch, removeLastSketch, SKETCH_LAYER_ID } from '../utilities/draw/sketch';
import { formatArea, formatDistance, formatDunam } from '../utilities/measure/format';
import { areaSquareMeters, lengthMeters, perimeterMeters } from '../utilities/measure/geodesic';
import { Section } from '../ui/OptionGroup';
import ui from '../ui/ui.module.css';
import styles from './MeasureDrawPanel.module.css';

function ToolBtn({ id, icon, label, active }: { id: DrawTool; icon: ReactNode; label: string; active: DrawTool }) {
  return (
    <button
      type="button"
      className={styles.tool}
      aria-pressed={active === id}
      onClick={() => drawController.setTool(active === id ? 'none' : id)}
      data-testid={`tool-${id}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Measure (UTL-03/04) and draw (UTL-05). Closing the panel stops the active tool. */
export function MeasureDrawPanel() {
  const { t } = useTranslation();
  const { tool, measurement } = useSyncExternalStore(drawController.subscribe, drawController.getState);
  const units = useWorkspace((s) => s.settings.units);
  const lang = useWorkspace((s) => s.settings.language);
  const sketchCount = useWorkspace((s) => {
    const data = (s.layers[SKETCH_LAYER_ID]?.source as { data?: { features?: unknown[] } } | undefined)?.data;
    return data?.features?.length ?? 0;
  });

  useEffect(() => () => drawController.setTool('none'), []);

  const sketchName = t('measure.sketchName');

  let result: ReactNode = <p className={ui.hint}>{t('measure.empty')}</p>;
  if (measurement) {
    const c = measurement.coordinates;
    if (measurement.kind === 'distance') {
      result = (
        <div className={styles.result} data-testid="measure-result">
          <div className={styles.value}>{formatDistance(lengthMeters(c), units, lang)}</div>
          <div className={styles.meta}>
            {t('measure.points', { count: c.length })}
            {!measurement.done && <> · {t('measure.live')}</>}
          </div>
        </div>
      );
    } else {
      const a = areaSquareMeters(c);
      const dunam = lang === 'he' ? formatDunam(a, units, lang) : null;
      result = (
        <div className={styles.result} data-testid="measure-result">
          <div className={styles.value}>{formatArea(a, units, lang)}</div>
          {dunam && <div className={styles.meta}>{dunam}</div>}
          <div className={styles.meta}>
            {t('measure.perimeter')}: {formatDistance(perimeterMeters(c), units, lang)}
            {!measurement.done && <> · {t('measure.live')}</>}
          </div>
        </div>
      );
    }
  }

  const hint =
    tool === 'point'
      ? t('measure.hintPoint')
      : tool === 'line' || tool === 'distance'
        ? t('measure.hintLine')
        : tool === 'polygon' || tool === 'area'
          ? t('measure.hintPolygon')
          : null;

  return (
    <>
      <Section title={t('measure.measure')}>
        <div className={styles.tools}>
          <ToolBtn id="distance" icon={<Ruler size={16} aria-hidden />} label={t('measure.distance')} active={tool} />
          <ToolBtn id="area" icon={<Square size={16} aria-hidden />} label={t('measure.area')} active={tool} />
        </div>
        {result}
        {measurement && (
          <button type="button" className={ui.dangerBtn} onClick={() => drawController.clearMeasurement()} data-testid="measure-clear">
            {t('measure.clear')}
          </button>
        )}
        <p className={ui.hint}>{t('measure.units', { units: t(`settings.${units}`) })}</p>
      </Section>

      <Section title={t('measure.draw')}>
        <div className={styles.tools}>
          <ToolBtn id="point" icon={<MapPin size={16} aria-hidden />} label={t('measure.point')} active={tool} />
          <ToolBtn id="line" icon={<Spline size={16} aria-hidden />} label={t('measure.line')} active={tool} />
          <ToolBtn id="polygon" icon={<Hexagon size={16} aria-hidden />} label={t('measure.polygon')} active={tool} />
        </div>
        <p className={ui.hint} data-testid="sketch-count">
          {sketchCount > 0 ? t('measure.sketchCount', { count: sketchCount }) : t('measure.sketchEmpty')}
        </p>
        <div className={styles.row}>
          <button
            type="button"
            className={ui.dangerBtn}
            disabled={sketchCount === 0}
            onClick={() => removeLastSketch(sketchName)}
            data-testid="sketch-undo"
          >
            <Undo2 size={14} aria-hidden /> {t('measure.undoLast')}
          </button>
          <button
            type="button"
            className={ui.dangerBtn}
            disabled={sketchCount === 0}
            onClick={() => clearSketch(sketchName)}
            data-testid="sketch-clear"
          >
            <Eraser size={14} aria-hidden /> {t('measure.clearSketch')}
          </button>
        </div>
        <p className={ui.hint}>{t('measure.sketchNote')}</p>
      </Section>

      {hint && (
        <p className={styles.hint} role="status" data-testid="draw-hint">
          {hint}
        </p>
      )}
    </>
  );
}
