import { ref, computed } from 'vue'

// ---------------------------------------------------------------------------
// Tema claro / oscuro
//
// Tres preferencias posibles: 'light', 'dark' y 'system' (por defecto). El tema
// RESUELTO ('light' u 'dark') se escribe siempre en <html data-theme> para que
// el CSS no tenga que duplicar reglas dentro de @media (prefers-color-scheme).
//
// El valor inicial ya lo aplica un script inline en index.html, antes de que
// Vue monte, para evitar el destello de tema equivocado.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'theme'
const VALID = ['light', 'dark', 'system']

const media = window.matchMedia('(prefers-color-scheme: dark)')

const readStored = () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  return VALID.includes(saved) ? saved : 'system'
}

const preference = ref(readStored())
const systemIsDark = ref(media.matches)

const resolvedTheme = computed(() =>
  preference.value === 'system'
    ? (systemIsDark.value ? 'dark' : 'light')
    : preference.value
)

const isDark = computed(() => resolvedTheme.value === 'dark')

const applyToDocument = () => {
  document.documentElement.dataset.theme = resolvedTheme.value
}

const setTheme = (value) => {
  if (!VALID.includes(value)) return
  preference.value = value
  if (value === 'system') {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, value)
  }
  applyToDocument()
}

/** Alterna claro ↔ oscuro fijando una preferencia explícita. */
const toggleTheme = () => setTheme(isDark.value ? 'light' : 'dark')

// Seguir al sistema mientras la preferencia sea 'system'
media.addEventListener('change', (e) => {
  systemIsDark.value = e.matches
  if (preference.value === 'system') applyToDocument()
})

// Mantener el tema sincronizado entre pestañas
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    preference.value = readStored()
    applyToDocument()
  }
})

// El script de index.html ya lo aplicó; esto cubre el caso de que falte.
applyToDocument()

// Quitamos el bloqueo de transiciones una vez montada la app
requestAnimationFrame(() => {
  document.documentElement.classList.remove('theme-booting')
})

/**
 * Lee colores del tema activo desde las variables CSS.
 * Lo usan las vistas que pintan con JS (FullCalendar y las barras del Gantt):
 * así el CSS sigue siendo la única fuente de verdad de la paleta.
 *
 * @param {string[]} names nombres de variables, sin el prefijo `--`
 * @returns {Record<string,string>}
 */
const readThemeColors = (names) => {
  const styles = getComputedStyle(document.documentElement)
  const out = {}
  for (const name of names) {
    out[name] = styles.getPropertyValue(`--${name}`).trim()
  }
  return out
}

export function useTheme() {
  return {
    preference,
    resolvedTheme,
    isDark,
    setTheme,
    toggleTheme,
    readThemeColors
  }
}

export { resolvedTheme, isDark, setTheme, toggleTheme, readThemeColors }
