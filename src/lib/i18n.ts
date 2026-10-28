import { getLocales } from 'expo-localization';
import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en/translation.json';

import { cache } from './storage';
import { STORAGE_KEYS, type Language } from './constants';

function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  if (code.includes('ru')) return 'ru';
  if (code.includes('ro')) return 'ro';
  return 'en';
}

function loadBundle(lang: Language): Record<string, string> {
  if (lang === 'ro') return require('../locales/ro/translation.json');
  if (lang === 'ru') return require('../locales/ru/translation.json');
  return en;
}

const detected = detectLanguage();
const resources: Resource = { en: { translation: en } };
if (detected !== 'en') {
  resources[detected] = { translation: loadBundle(detected) };
}

i18n.use(initReactI18next).init({
  resources,
  lng: detected,
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

async function ensureLoaded(lang: Language): Promise<void> {
  if (i18n.hasResourceBundle(lang, 'translation')) return;
  i18n.addResourceBundle(lang, 'translation', loadBundle(lang));
}

export async function loadPersistedLanguage(): Promise<void> {
  const stored = await cache.get<Language>(STORAGE_KEYS.language);
  if (stored && stored !== i18n.language) {
    await ensureLoaded(stored);
    await i18n.changeLanguage(stored);
  }
}

export async function setAppLanguage(lang: Language): Promise<void> {
  await ensureLoaded(lang);
  await i18n.changeLanguage(lang);
  await cache.set(STORAGE_KEYS.language, lang);
}

export default i18n;
