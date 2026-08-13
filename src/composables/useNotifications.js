import { ref } from 'vue'

// Estado global (singleton a nivel de módulo): cualquier composable o vista
// puede lanzar notificaciones y todas se renderizan en el mismo <ToastHost />.
const notifications = ref([])
let nextId = 1

const DEFAULT_DURATIONS = {
  success: 3500,
  info: 4000,
  warning: 7000,
  error: 9000
}

const dismiss = (id) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index === -1) return
  const [removed] = notifications.value.splice(index, 1)
  if (removed?.timer) clearTimeout(removed.timer)
}

/**
 * Muestra una notificación.
 * @param {object} options
 * @param {'success'|'error'|'warning'|'info'} options.type
 * @param {string} options.title
 * @param {string} [options.message] Detalle opcional bajo el título
 * @param {number} [options.duration] ms hasta el auto-cierre (0 = permanente)
 * @param {{label: string, handler: Function}} [options.action] Botón de acción
 * @param {string} [options.key] Clave para evitar duplicados (reemplaza la anterior)
 */
const notify = ({ type = 'info', title, message = '', duration, action = null, key = null }) => {
  // Si ya existe una notificación con la misma clave, la reemplazamos en vez de apilar
  if (key) {
    const existing = notifications.value.find(n => n.key === key)
    if (existing) dismiss(existing.id)
  }

  const id = nextId++
  const ttl = duration ?? DEFAULT_DURATIONS[type] ?? 4000

  const item = { id, key, type, title, message, action, timer: null }

  // Las notificaciones con acción no se cierran solas: el usuario debe decidir
  if (ttl > 0 && !action) {
    item.timer = setTimeout(() => dismiss(id), ttl)
  }

  notifications.value.push(item)
  return id
}

/** ¿Sigue visible la notificación con ese id? (el usuario pudo cerrarla a mano) */
const isVisible = (id) => id !== null && notifications.value.some(n => n.id === id)

export function useNotifications() {
  return {
    notifications,
    notify,
    dismiss,
    notifySuccess: (title, message, opts = {}) => notify({ type: 'success', title, message, ...opts }),
    notifyError: (title, message, opts = {}) => notify({ type: 'error', title, message, ...opts }),
    notifyWarning: (title, message, opts = {}) => notify({ type: 'warning', title, message, ...opts }),
    notifyInfo: (title, message, opts = {}) => notify({ type: 'info', title, message, ...opts })
  }
}

// Export directo para usar fuera de componentes (servicios, composables, router)
export { notify, dismiss, isVisible }
