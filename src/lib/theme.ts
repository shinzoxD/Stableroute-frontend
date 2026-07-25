import {
  rawStringSerializer,
  readLocalStorageValue,
  writeLocalStorageValue,
} from './useLocalStorage';

export type Theme = 'light' | 'dark' | 'system';

// Also hardcoded in public/theme-init.js, which runs before React hydrates
// and cannot import this module. Keep both in sync if this ever changes.
export const THEME_KEY = 'stableroute.theme';

/**
 * Same-tab event name fired after a theme preference write.
 * The native `storage` event only fires across tabs, so settings UI
 * (e.g. AppearancePreview) listens for this to update live in-page.
 */
export const THEME_CHANGE_EVENT = 'stableroute:themechange';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

// Stored as a plain string ("dark", not '"dark"') so it stays byte-for-byte
// compatible with theme-init.js's raw localStorage.getItem() comparison and
// with values persisted before this module existed.
export function readTheme(): Theme {
  return readLocalStorageValue(
    THEME_KEY,
    'system',
    isTheme,
    rawStringSerializer
  );
}

/**
 * Persist a theme preference and notify same-tab listeners.
 * Cross-tab listeners continue to use the native `storage` event.
 */
export function writeTheme(theme: Theme) {
  writeLocalStorageValue(THEME_KEY, theme, rawStringSerializer);
  notifyThemeChange();
}

/**
 * Dispatch {@link THEME_CHANGE_EVENT} so in-page consumers re-read theme.
 * Safe no-op during SSR.
 */
export function notifyThemeChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Resolve a stored preference to the concrete light/dark surface. */
export function effectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
