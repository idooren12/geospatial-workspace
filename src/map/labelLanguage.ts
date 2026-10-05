import type { ExpressionSpecification } from 'maplibre-gl';
import type { LabelLanguage } from './types';

/** Label expression for place names in the chosen language, falling back to the local name. */
export function labelExpression(lang: LabelLanguage): ExpressionSpecification {
  return lang === 'he'
    ? ['coalesce', ['get', 'name:he'], ['get', 'name']]
    : ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];
}

/**
 * A basemap symbol layer shows a *name* (as opposed to a house number, road ref, etc.)
 * when its text-field mentions a name property.
 */
export function isNameLabel(textField: unknown): boolean {
  if (textField == null) return false;
  return /name/.test(JSON.stringify(textField));
}
