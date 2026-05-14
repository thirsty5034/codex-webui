/**
 * Shared theme state — single source of truth for dark mode.
 * Persisted to localStorage. Falls back to system preference.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'codex.webui.theme';

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTheme(dark: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  } catch {
    // Storage unavailable in restricted contexts — skip silently.
  }
}

function getInitialDark(): boolean {
  const stored = readStoredTheme();
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyAndPersist(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  writeStoredTheme(dark);
}

interface ThemeState {
  dark: boolean;
  setDark: (dark: boolean) => void;
  toggleDark: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  dark: getInitialDark(),

  setDark: (dark) => {
    applyAndPersist(dark);
    set({ dark });
  },

  toggleDark: () =>
    set((state) => {
      const dark = !state.dark;
      applyAndPersist(dark);
      return { dark };
    }),
}));
