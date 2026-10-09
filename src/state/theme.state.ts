export type ThemeChoice = 'system' | 'light' | 'dark'

export const themeChoices: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const storageKey = 'pyn-theme'

export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(storageKey)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, choice)
  } catch {
    // Storage can be blocked; the choice then lasts for this page load only.
  }
}

/** System removes the override so prefers-color-scheme decides. */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement) {
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
}
