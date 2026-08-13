import { ref, computed } from 'vue'
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth'
import { auth } from '../services/firebase/config'
import {
  requestGoogleAccessToken,
  revokeGoogleToken,
  isGisConfigured,
  GOOGLE_SCOPES
} from '../services/google/gisClient'
import { notify, dismiss, isVisible } from './useNotifications'

// ---------------------------------------------------------------------------
// Gestión del access token de Google (Calendar + Gmail)
//
// El access token de Google vive ~1 hora y Firebase NO lo renueva. Este módulo:
//   1. Guarda el token junto con su fecha de caducidad real.
//   2. Lo renueva de forma silenciosa ANTES de que caduque (timer proactivo).
//   3. Lo renueva bajo demanda si alguna llamada lo necesita y está vencido.
//   4. Si la renovación silenciosa no es posible, avisa al usuario con un
//      aviso persistente y un botón de "Reconectar" (un clic, sin perder nada).
//
// Estado global a nivel de módulo: hay un único token para toda la app.
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'gcal_token'
const EXPIRY_KEY = 'gcal_token_expires_at'

// Margen de seguridad: consideramos el token "vencido" 5 minutos antes de que
// realmente lo esté, para no perder una petición justo en el límite.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000
// Renovamos proactivamente 10 minutos antes de la caducidad real.
const PROACTIVE_RENEW_MARGIN_MS = 10 * 60 * 1000

const accessToken = ref(localStorage.getItem(TOKEN_KEY) || null)
const expiresAt = ref(Number(localStorage.getItem(EXPIRY_KEY)) || 0)
// 'connected' | 'renewing' | 'disconnected'
// El estado inicial tiene en cuenta la caducidad guardada: un token presente
// pero vencido (o sin fecha, como los guardados por la versión anterior) NO
// cuenta como conectado.
const status = ref(
  accessToken.value && Date.now() < (expiresAt.value - EXPIRY_MARGIN_MS)
    ? 'connected'
    : 'disconnected'
)
const lastError = ref(null)

let renewTimer = null
let inFlightRenewal = null   // single-flight: evita renovaciones simultáneas
let listenersAttached = false
let reconnectNoticeId = null

const isExpired = () => !accessToken.value || Date.now() >= (expiresAt.value - EXPIRY_MARGIN_MS)

const hasValidToken = computed(() => Boolean(accessToken.value) && Date.now() < (expiresAt.value - EXPIRY_MARGIN_MS))

const clearRenewTimer = () => {
  if (renewTimer) {
    clearTimeout(renewTimer)
    renewTimer = null
  }
}

const clearReconnectNotice = () => {
  if (reconnectNoticeId !== null) {
    dismiss(reconnectNoticeId)
    reconnectNoticeId = null
  }
}

/** Programa la renovación silenciosa antes de que el token caduque. */
const scheduleProactiveRenewal = () => {
  clearRenewTimer()
  if (!expiresAt.value) return

  const delay = expiresAt.value - Date.now() - PROACTIVE_RENEW_MARGIN_MS
  // Si ya estamos dentro de la ventana, renovamos en 1s (no de forma síncrona,
  // para no bloquear el flujo que acaba de guardar el token).
  renewTimer = setTimeout(() => { renewSilently().catch(() => {}) }, Math.max(delay, 1000))
}

const setToken = (token, expiresInSeconds) => {
  accessToken.value = token
  expiresAt.value = Date.now() + (expiresInSeconds * 1000)
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EXPIRY_KEY, String(expiresAt.value))
  status.value = 'connected'
  lastError.value = null
  clearReconnectNotice()
  scheduleProactiveRenewal()
}

const clearToken = ({ revoke = false } = {}) => {
  if (revoke && accessToken.value) revokeGoogleToken(accessToken.value)
  accessToken.value = null
  expiresAt.value = 0
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
  status.value = 'disconnected'
  clearRenewTimer()
  clearReconnectNotice()
}

/** Aviso persistente con botón de reconexión (un solo clic para el usuario). */
const showReconnectNotice = (reason) => {
  // Solo evitamos duplicarlo si el aviso sigue en pantalla. Si el usuario lo
  // cerró a mano, la siguiente operación que falle vuelve a mostrarlo.
  if (isVisible(reconnectNoticeId)) return
  reconnectNoticeId = null
  reconnectNoticeId = notify({
    type: 'warning',
    key: 'google-reconnect',
    title: 'Conexión con Google caducada',
    message: reason || 'Tus tareas se siguen guardando, pero la sincronización con Calendar y Gmail está pausada.',
    duration: 0,
    action: {
      label: 'Reconectar',
      handler: async () => {
        reconnectNoticeId = null
        await reconnectInteractive()
      }
    }
  })
}

/**
 * Renovación silenciosa: sin popups ni interacción del usuario.
 * Usa single-flight para que N llamadas concurrentes compartan una sola petición.
 */
const renewSilently = async () => {
  if (inFlightRenewal) return inFlightRenewal

  inFlightRenewal = (async () => {
    if (!auth.currentUser) {
      clearToken()
      throw new Error('NO_SESSION')
    }

    if (!isGisConfigured()) {
      // Sin VITE_GOOGLE_CLIENT_ID no existe renovación silenciosa posible:
      // solo queda el popup manual.
      const err = new Error('GIS_NOT_CONFIGURED')
      err.code = 'GIS_NOT_CONFIGURED'
      throw err
    }

    status.value = 'renewing'
    try {
      const { accessToken: token, expiresIn } = await requestGoogleAccessToken({
        interactive: false,
        loginHint: auth.currentUser.email || ''
      })
      setToken(token, expiresIn)
      return token
    } catch (err) {
      status.value = 'disconnected'
      lastError.value = err
      throw err
    } finally {
      inFlightRenewal = null
    }
  })()

  return inFlightRenewal
}

/**
 * Reconexión interactiva (requiere un gesto del usuario: clic en "Reconectar").
 * Primero intenta GIS; si no está configurado, cae al popup de Firebase.
 */
const reconnectInteractive = async () => {
  if (!auth.currentUser) {
    notify({ type: 'error', title: 'Sesión cerrada', message: 'Vuelve a iniciar sesión para continuar.' })
    return null
  }

  status.value = 'renewing'
  try {
    if (isGisConfigured()) {
      const { accessToken: token, expiresIn } = await requestGoogleAccessToken({
        interactive: true,
        loginHint: auth.currentUser.email || ''
      })
      setToken(token, expiresIn)
    } else {
      // Fallback sin Client ID: re-autenticación con popup de Firebase.
      const provider = new GoogleAuthProvider()
      GOOGLE_SCOPES.split(' ').forEach(scope => provider.addScope(scope))
      provider.setCustomParameters({ login_hint: auth.currentUser.email || '' })

      const result = await reauthenticateWithPopup(auth.currentUser, provider)
      const credential = GoogleAuthProvider.credentialFromResult(result)
      if (!credential?.accessToken) throw new Error('Google no devolvió un token de acceso')
      // Firebase no informa la caducidad: Google emite tokens de 1 hora.
      setToken(credential.accessToken, 3600)
    }

    notify({ type: 'success', title: 'Conexión con Google restablecida', message: 'La sincronización con Calendar y Gmail vuelve a estar activa.' })
    return accessToken.value
  } catch (err) {
    status.value = 'disconnected'
    lastError.value = err
    notify({
      type: 'error',
      key: 'google-reconnect-failed',
      title: 'No se pudo reconectar con Google',
      message: describeTokenError(err),
      duration: 0,
      action: { label: 'Reintentar', handler: () => reconnectInteractive() }
    })
    return null
  }
}

/**
 * Devuelve un token válido, renovándolo si hace falta.
 * @param {object} [options]
 * @param {boolean} [options.forceRenew=false] Fuerza la renovación aunque no haya caducado
 *   (se usa tras recibir un 401 de la API de Google).
 * @returns {Promise<string|null>} token válido, o null si hay que reconectar manualmente
 */
const getValidToken = async ({ forceRenew = false } = {}) => {
  if (!auth.currentUser) return null

  if (!forceRenew && !isExpired()) return accessToken.value

  try {
    return await renewSilently()
  } catch (err) {
    // La renovación automática falló: el usuario tiene que autorizar de nuevo.
    // No lanzamos error: quien llame decidirá si puede continuar sin Google.
    showReconnectNotice(
      err?.code === 'GIS_NOT_CONFIGURED'
        ? 'Reconecta tu cuenta de Google para volver a sincronizar Calendar y Gmail.'
        : null
    )
    return null
  }
}

/** Guarda el token recién obtenido en el login inicial. */
const setTokenFromLogin = (token, expiresInSeconds = 3600) => {
  if (!token) return
  setToken(token, expiresInSeconds)
}

const describeTokenError = (err) => {
  const code = err?.code || ''
  if (code === 'popup_closed' || code === 'auth/popup-closed-by-user') {
    return 'Cerraste la ventana de Google antes de terminar.'
  }
  if (code === 'popup_failed_to_open' || code === 'auth/popup-blocked') {
    return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio.'
  }
  if (code === 'access_denied') {
    return 'Se rechazaron los permisos de Calendar/Gmail.'
  }
  if (code === 'GIS_NOT_CONFIGURED') {
    return 'Falta configurar VITE_GOOGLE_CLIENT_ID para la renovación automática.'
  }
  if (code === 'silent_timeout') {
    return 'Google no respondió a tiempo. Puede que tu sesión de Google esté cerrada.'
  }
  return err?.message || 'Error desconocido.'
}

/**
 * Listeners globales: renovamos el token cuando la pestaña vuelve a primer plano
 * o cuando se recupera la conexión. Cubre el caso típico de dejar la app abierta
 * toda la noche y volver por la mañana con el token caducado.
 */
const attachGlobalListeners = () => {
  if (listenersAttached) return
  listenersAttached = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && auth.currentUser && isExpired()) {
      getValidToken().catch(() => {})
    }
  })

  window.addEventListener('online', () => {
    if (auth.currentUser && isExpired()) getValidToken().catch(() => {})
  })

  // Sincroniza el estado entre pestañas: si otra pestaña renueva el token,
  // esta lo adopta en lugar de lanzar una renovación duplicada.
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY) {
      accessToken.value = event.newValue
      status.value = event.newValue ? 'connected' : 'disconnected'
      if (event.newValue) clearReconnectNotice()
    }
    if (event.key === EXPIRY_KEY) {
      expiresAt.value = Number(event.newValue) || 0
      scheduleProactiveRenewal()
    }
  })
}

/** Arranca la gestión del token para el usuario ya autenticado. */
const initGoogleToken = () => {
  attachGlobalListeners()
  if (!auth.currentUser) return

  if (isExpired()) {
    // Renovación en segundo plano al cargar la app con el token vencido.
    getValidToken().catch(() => {})
  } else {
    status.value = 'connected'
    scheduleProactiveRenewal()
  }
}

export function useGoogleToken() {
  return {
    accessToken,
    expiresAt,
    status,
    lastError,
    hasValidToken,
    getValidToken,
    reconnectInteractive,
    setTokenFromLogin,
    clearToken,
    initGoogleToken
  }
}

export {
  getValidToken,
  reconnectInteractive,
  setTokenFromLogin,
  clearToken,
  initGoogleToken,
  describeTokenError,
  status as googleTokenStatus,
  hasValidToken as hasValidGoogleToken
}
