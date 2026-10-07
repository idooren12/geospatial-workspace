import { Eye, EyeOff, Focus, Ruler, Save, Square, Trash2 } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { drawController, type DrawTool } from '../map/draw/DrawController';
import { mapService } from '../map/MapService';
import { useWorkspace } from '../store/workspaceStore';
import { EditableName } from '../ui/EditableName';
import { useReveal } from '../ui/useReveal';
import { Section } from '../ui/OptionGroup';
import ui from '../ui/ui.module.css';
import { formatArea, formatDistance, formatDunam } from '../utilities/measure/format';
import { areaSquareMeters, lengthMeters, perimeterMeters } from '../utilities/measure/geodesic';
import { measurementValue } from '../utilities/measure/measurementOverlay';
import type { SavedMeasurement } from '../utilities/measure/types';
import styles from './toolPanels.module.css';

const MEASURE_TOOLS: DrawTool[] = ['distance', 'area'];

export function ToolButton({ id, icon, label, active }: { id: DrawTool; icon: ReactNode; label: string; active: DrawTool }) {
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

/**
 * Measurements (UTL-03/04) with their own saved list — they are not layers. The live measurement
 * is temporary; Save keeps it (on the map, labelled, and in the list below).
 */
export function MeasurePanel() {
  const { t } = useTranslation();
  const { tool, measurement } = useSyncExternalStore(drawController.subscribe, drawController.getState);
  const units = useWorkspace((s) => s.settings.units);
  const lang = useWorkspace((s) => s.settings.language);
  const saved = useWorkspace((s) => s.measurements);
  const save = useWorkspace((s) => s.saveMeasurement);
  const [name, setName] = useState('');

  // Closing this panel stops a measuring tool (not a drawing tool from the Draw panel).
  useEffect(
    () => () => {
      if (MEASURE_TOOLS.includes(drawController.getState().tool)) drawController.setTool('none');
    },
    [],
  );

  const defaultName = t('measure.defaultName', { n: saved.length + 1 });
  const c = measurement?.coordinates ?? [];
  const canSave = !!measurement?.done && c.length >= (measurement.kind === 'area' ? 3 : 2);

  let result: ReactNode = <p className={ui.hint}>{t('measure.empty')}</p>;
  if (measurement) {
    const live = !measurement.done && <> · {t('measure.live')}</>;
    if (measurement.kind === 'distance') {
      result = (
        <div className={styles.result} data-testid="measure-result">
          <div className={styles.value}>{formatDistance(lengthMeters(c), units, lang)}</div>
          <div className={styles.meta}>
            {t('measure.points', { count: c.length })}
            {live}
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
            {live}
          </div>
        </div>
      );
    }
  }

  const doSave = () => {
    if (!measurement || !canSave) return;
    save({
      name: name.trim() || defaultName,
      kind: measurement.kind,
      coordinates: measurement.coordinates.map((p) => [p[0]!, p[1]!] as [number, number]),
    });
    setName('');
    drawController.clearMeasurement();
  };

  return (
    <>
      <Section title={t('measure.measure')}>
        <div className={styles.tools}>
          <ToolButton id="distance" icon={<Ruler size={16} aria-hidden />} label={t('measure.distance')} active={tool} />
          <ToolButton id="area" icon={<Square size={16} aria-hidden />} label={t('measure.area')} active={tool} />
        </div>
        {result}
        {canSave && (
          <div className={ui.inline}>
            <input
              value={name}
              placeholder={defaultName}
              aria-label={t('measure.saveName')}
              dir="auto"
              onChange={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSave()}
              data-testid="measure-name"
            />
            <button type="button" className={ui.primaryBtn} onClick={doSave} data-testid="measure-save">
              <Save size={14} aria-hidden /> {t('measure.save')}
            </button>
          </div>
        )}
        {measurement && (
          <button type="button" className={ui.dangerBtn} onClick={() => drawController.clearMeasurement()} data-testid="measure-clear">
            {t('measure.clear')}
          </button>
        )}
        <p className={ui.hint}>{t('measure.units', { units: t(`settings.${units}`) })}</p>
      </Section>

      <Section title={t('measure.saved')}>
        {saved.length === 0 ? (
          <p className={ui.empty} data-testid="saved-empty">
            {t('measure.savedEmpty')}
          </p>
        ) : (
          <ul className={ui.items} data-testid="saved-list">
            {[...saved].reverse().map((m) => (
              <SavedRow key={m.id} m={m} value={measurementValue(m, units, lang)} />
            ))}
          </ul>
        )}
      </Section>

      {(tool === 'distance' || tool === 'area') && (
        <p className={styles.hint} role="status" data-testid="draw-hint">
          {tool === 'distance' ? t('measure.hintLine') : t('measure.hintPolygon')}
        </p>
      )}
    </>
  );
}

function boundsOf(coords: [number, number][]): [[number, number], [number, number]] {
  const xs = coords.map((p) => p[0]);
  const ys = coords.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

function SavedRow({ m, value }: { m: SavedMeasurement; value: string }) {
  const { t } = useTranslation();
  const update = useWorkspace((s) => s.updateMeasurement);
  const remove = useWorkspace((s) => s.removeMeasurement);
  const focus = useWorkspace((s) => (s.focus?.kind === 'measurement' && s.focus.id === m.id ? s.focus.seq : undefined));
  const ref = useReveal(focus !== undefined, focus);
  return (
    <li ref={ref} className={ui.item} data-hidden={!m.visible} data-testid={`saved-${m.id}`}>
      <button
        type="button"
        className={ui.iconBtn}
        aria-pressed={m.visible}
        aria-label={t(m.visible ? 'layers.hide' : 'layers.show', { name: m.name })}
        title={t(m.visible ? 'layers.hide' : 'layers.show', { name: m.name })}
        onClick={() => update(m.id, { visible: !m.visible })}
        data-testid="saved-visibility"
      >
        {m.visible ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
      </button>
      <EditableName value={m.name} onRename={(name) => update(m.id, { name })} testId="saved-name" />
      <span className={ui.itemValue} data-testid="saved-value">
        {value}
      </span>
      <button
        type="button"
        className={ui.iconBtn}
        aria-label={t('common.zoomTo', { name: m.name })}
        title={t('common.zoomTo', { name: m.name })}
        onClick={() => mapService.fitBounds(boundsOf(m.coordinates), { padding: 80, maxZoom: 16 })}
      >
        <Focus size={14} aria-hidden />
      </button>
      <button
        type="button"
        className={ui.iconBtn}
        aria-label={t('common.delete', { name: m.name })}
        title={t('common.delete', { name: m.name })}
        onClick={() => remove(m.id)}
        data-testid="saved-remove"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </li>
  );
}
