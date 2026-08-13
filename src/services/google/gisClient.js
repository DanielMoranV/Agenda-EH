// Wrapper sobre Google Identity Services (GIS) para obtener tokens OAuth
// de acceso SIN volver a pasar por el login completo de Firebase.
//
// ¿Por qué hace falta esto?
// Firebase Auth renueva automáticamente su propio ID token, pero NO renueva el
// access token de Google que devuelve signInWithPopup: ese caduca a la hora y
// el SDK de Firebase no guarda el refresh token en el cliente. Sin esto, todas
// las llamadas a Calendar y Gmail empiezan a fallar con 401 pasados ~60 min.
//
// GIS sí permite pedir un token nuevo de forma silenciosa (prompt: '') siempre
// que el usuario mantenga su sesión de Google abierta en el navegador y ya haya
// concedido los scopes anteriormente.

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send'
].join(' ')

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

let scriptPromise = null
let tokenClient = null

/** ¿Está configurado el Client ID de OAuth? Si no, no hay renovación silenciosa. */
export const isGisConfigured = () => Boolean(CLIENT_ID)

/** Carga el script de GIS una sola vez (idempotente). */
const loadGisScript = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services')))
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('No se pudo cargar Google Identity Services'))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * Pide un access token a Google.
 *
 * @param {object} options
 * @param {boolean} [options.interactive=false] true muestra el selector/consentimiento
 *   de Google (requiere gesto del usuario). false intenta la renovación silenciosa.
 * @param {string} [options.loginHint] Email del usuario: mejora mucho la tasa de
 *   éxito del flujo silencioso cuando hay varias cuentas de Google.
 * @returns {Promise<{accessToken: string, expiresIn: number, scope: string}>}
 */
export const requestGoogleAccessToken = async ({ interactive = false, loginHint = '' } = {}) => {
  if (!CLIENT_ID) {
    throw new Error('GIS_NOT_CONFIGURED')
  }

  await loadGisScript()

  return new Promise((resolve, reject) => {
    // El callback se reasigna en cada petición, por eso reutilizamos el cliente
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: () => {} // se sobreescribe justo antes de cada requestAccessToken
      })
    }

    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        const err = new Error(response.error_description || response.error)
        err.code = response.error
        return finish(reject, err)
      }
      finish(resolve, {
        accessToken: response.access_token,
        expiresIn: Number(response.expires_in) || 3600,
        scope: response.scope || GOOGLE_SCOPES
      })
    }

    tokenClient.error_callback = (err) => {
      const error = new Error(err?.message || 'Error solicitando el token de Google')
      error.code = err?.type || 'gis_error'
      finish(reject, error)
    }

    // Si el flujo silencioso no puede completarse, GIS a veces no invoca ningún
    // callback (por ejemplo si el iframe queda bloqueado por cookies de terceros).
    // Un timeout evita dejar la promesa colgada para siempre.
    if (!interactive) {
      setTimeout(() => {
        const error = new Error('La renovación silenciosa del token agotó el tiempo de espera')
        error.code = 'silent_timeout'
        finish(reject, error)
      }, 12000)
    }

    tokenClient.requestAccessToken({
      prompt: interactive ? 'consent' : '',
      login_hint: loginHint || undefined
    })
  })
}

/** Revoca el token actual en Google (usado al cerrar sesión). */
export const revokeGoogleToken = (token) => {
  if (!token || !window.google?.accounts?.oauth2) return
  try {
    window.google.accounts.oauth2.revoke(token, () => {})
  } catch {
    // Revocar es "best effort": si falla, el token caduca solo en una hora
  }
}
