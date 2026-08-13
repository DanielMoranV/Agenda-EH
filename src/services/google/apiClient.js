import { getValidToken } from '../../composables/useGoogleToken'

/**
 * Error tipado de las APIs de Google. Permite que la UI distinga entre
 * "hay que reconectar" y "el dato es inválido" sin parsear cadenas de texto.
 */
export class GoogleApiError extends Error {
  constructor(message, { status = 0, reason = '', isAuthError = false, apiName = 'Google', details = null } = {}) {
    super(message)
    this.name = 'GoogleApiError'
    this.status = status
    this.reason = reason
    this.isAuthError = isAuthError
    this.apiName = apiName
    this.details = details
  }
}

/** Se lanza cuando no hay token válido y la renovación automática no fue posible. */
export class GoogleAuthRequiredError extends GoogleApiError {
  constructor(apiName = 'Google') {
    super('Se necesita volver a autorizar el acceso a Google', {
      status: 401,
      reason: 'reauth_required',
      isAuthError: true,
      apiName
    })
    this.name = 'GoogleAuthRequiredError'
  }
}

/** Extrae un mensaje legible del cuerpo de error de Google. */
const parseErrorBody = async (response) => {
  const raw = await response.text()
  try {
    const json = JSON.parse(raw)
    const err = json.error || {}
    return {
      message: err.message || raw,
      reason: err.status || err.errors?.[0]?.reason || '',
      details: json
    }
  } catch {
    return { message: raw, reason: '', details: raw }
  }
}

const AUTH_REASONS = new Set([
  'UNAUTHENTICATED',
  'authError',
  'invalid_token',
  'invalidCredentials',
  'PERMISSION_DENIED',
  'insufficientPermissions',
  'ACCESS_TOKEN_EXPIRED'
])

const isAuthFailure = (status, reason) => {
  if (status === 401) return true
  // Un 403 solo es de sesión si el motivo apunta a credenciales/scopes,
  // no cuando es cuota excedida o rate limit.
  if (status === 403) return AUTH_REASONS.has(reason)
  return false
}

/**
 * Realiza una llamada autenticada a una API de Google.
 *
 * - Obtiene un token válido (renovándolo en silencio si hace falta).
 * - Si Google responde 401/403-credenciales, fuerza una renovación y reintenta UNA vez.
 * - Si tras el reintento sigue fallando, lanza GoogleAuthRequiredError para que la
 *   UI muestre el aviso de reconexión.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {{apiName?: string, allowStatuses?: number[]}} meta
 * @returns {Promise<Response>}
 */
export const googleFetch = async (url, options = {}, { apiName = 'Google', allowStatuses = [] } = {}) => {
  const execute = async (token) => fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  })

  let token = await getValidToken()
  if (!token) throw new GoogleAuthRequiredError(apiName)

  let response = await execute(token)

  if (!response.ok && !allowStatuses.includes(response.status)) {
    const { message, reason, details } = await parseErrorBody(response.clone())

    if (isAuthFailure(response.status, reason)) {
      // El token fue rechazado antes de su caducidad teórica (revocado, scopes
      // cambiados, contraseña modificada...). Forzamos renovación y reintentamos.
      token = await getValidToken({ forceRenew: true })
      if (!token) throw new GoogleAuthRequiredError(apiName)

      response = await execute(token)
      if (response.ok || allowStatuses.includes(response.status)) return response

      const retryError = await parseErrorBody(response.clone())
      if (isAuthFailure(response.status, retryError.reason)) {
        throw new GoogleAuthRequiredError(apiName)
      }
      throw new GoogleApiError(retryError.message, {
        status: response.status,
        reason: retryError.reason,
        apiName,
        details: retryError.details
      })
    }

    throw new GoogleApiError(message, {
      status: response.status,
      reason,
      apiName,
      details
    })
  }

  return response
}

/** Traduce un error de API a un mensaje corto y accionable para el usuario. */
export const describeGoogleApiError = (err) => {
  if (err instanceof GoogleAuthRequiredError) {
    return 'Tu autorización de Google caducó. Pulsa "Reconectar" para restablecerla.'
  }
  if (err instanceof GoogleApiError) {
    if (err.status === 429 || err.reason === 'RESOURCE_EXHAUSTED') {
      return 'Google está limitando las peticiones. Inténtalo de nuevo en unos minutos.'
    }
    if (err.status === 404) return 'El recurso ya no existe en Google.'
    if (err.status >= 500) return 'Google tuvo un problema temporal. Inténtalo de nuevo.'
    return err.message
  }
  if (err?.name === 'TypeError') return 'Sin conexión con Google. Revisa tu red.'
  return err?.message || 'Error inesperado al contactar con Google.'
}
