import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import he from './he.json';
import type { Language } from '../store/persistence';

export const dirOf = (lang: Language): 'rtl' | 'ltr' => (lang === 'he' ? 'rtl' : 'ltr');

/** Keeps <html lang dir> in sync with the UI language; CSS logical properties do the rest. */
export function applyDocumentLanguage(lang: Language): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
}

export function initI18n(lang: Language) {
  void i18n.use(initReactI18next).init({
    resources: { he: { translation: he }, en: { translation: en } },
    lng: lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  applyDocumentLanguage(lang);
  return i18n;
}

export default i18n;
