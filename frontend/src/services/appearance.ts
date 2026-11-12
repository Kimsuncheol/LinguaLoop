import { ref } from 'vue'

type Appearance = 'system' | 'light' | 'dark'
const storageKey = 'lingualoop-appearance'
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const isAppearance = (value: unknown): value is Appearance =>
  value === 'system' || value === 'light' || value === 'dark'

function readAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(storageKey)
    return isAppearance(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export const appearance = ref<Appearance>(readAppearance())

function applyAppearance() {
  const dark = appearance.value === 'dark' ||
    (appearance.value === 'system' && systemTheme.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', dark ? '#101b17' : '#245c4b',
  )
}

export function setAppearance(value: string) {
  if (!isAppearance(value)) return
  appearance.value = value
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // The setting still works for this visit when storage is unavailable.
  }
  applyAppearance()
}

systemTheme.addEventListener('change', applyAppearance)
window.addEventListener('storage', (event) => {
  if (event.key === storageKey || event.key === null) {
    appearance.value = readAppearance()
    applyAppearance()
  }
})
applyAppearance()
