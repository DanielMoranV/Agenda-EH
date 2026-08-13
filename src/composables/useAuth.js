import { ref, computed } from 'vue'
import { auth } from '../services/firebase/config'
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import { GOOGLE_SCOPES } from '../services/google/gisClient'
import { setTokenFromLogin, clearToken, initGoogleToken } from './useGoogleToken'
import { notify } from './useNotifications'

// ---------------------------------------------------------------------------
// Estado de autenticación GLOBAL (singleton a nivel de módulo).
//
// Antes cada componente que llamaba a useAuth() creaba sus propios refs y su
// propio listener onAuthStateChanged, así que el estado podía divergir entre
// vistas. Ahora hay un único observador para toda la app.
// ---------------------------------------------------------------------------

const user = ref(auth.currentUser)
const loading = ref(true)
const error = ref(null)
// authReady = ya sabemos con certeza si hay sesión o no (el primer callback llegó)
const authReady = ref(false)
// Motivo por el que se perdió la sesión, para mostrarlo en el login
const sessionEndReason = ref(null)

let readyResolve
const authReadyPromise = new Promise((resolve) => { readyResolve = resolve })

// La sesión de Firebase debe sobrevivir a cerrar el navegador.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('No se pudo configurar la persistencia de sesión:', err)
})

const buildProvider = ({ forceConsent = false, loginHint = '' } = {}) => {
  const provider = new GoogleAuthProvider()
  // Permisos para gestionar eventos de calendario y enviar correos
  GOOGLE_SCOPES.split(' ').forEach(scope => provider.addScope(scope))

  const params = {}
  // 'consent' solo cuando hace falta forzar la pantalla de permisos. Pedirlo
  // siempre impedía que Google reutilizara la concesión previa y molestaba al
  // usuario en cada inicio de sesión.
  if (forceConsent) params.prompt = 'consent'
  if (loginHint) params.login_hint = loginHint
  provider.setCustomParameters(params)

  return provider
}

/** Traduce los códigos de error de Firebase Auth a mensajes en español. */
export const describeAuthError = (err) => {
  const messages = {
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de completar el inicio de sesión.',
    'auth/cancelled-popup-request': 'Se canceló el inicio de sesión anterior.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.',
    'auth/network-request-failed': 'Sin conexión a internet. Revisa tu red e inténtalo de nuevo.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada. Contacta con el administrador.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
    'auth/operation-not-allowed': 'El acceso con Google no está habilitado en Firebase.',
    'auth/internal-error': 'Error interno de autenticación. Inténtalo de nuevo.',
    'auth/user-token-expired': 'Tu sesión caducó. Inicia sesión de nuevo.',
    'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión para continuar.'
  }
  return messages[err?.code] || err?.message || 'No se pudo completar la autenticación.'
}

const loginWithGoogle = async ({ forceConsent = false } = {}) => {
  error.value = null
  sessionEndReason.value = null
  loading.value = true
  try {
    const result = await signInWithPopup(auth, buildProvider({ forceConsent }))

    // Access token OAuth necesario para las APIs REST de Calendar y Gmail
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (credential?.accessToken) {
      // Google emite estos tokens con 1 hora de vida; a partir de aquí
      // useGoogleToken se encarga de renovarlo solo antes de que caduque.
      setTokenFromLogin(credential.accessToken, 3600)
    }

    user.value = result.user
    return result.user
  } catch (err) {
    console.error('Error en login:', err)
    error.value = describeAuthError(err)
    // Cerrar el popup a propósito no es un fallo que merezca una alerta roja
    if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
      notify({ type: 'error', title: 'No se pudo iniciar sesión', message: error.value })
    }
    return null
  } finally {
    loading.value = false
  }
}

const logout = async ({ silent = false } = {}) => {
  loading.value = true
  try {
    clearToken({ revoke: true })
    await signOut(auth)
    user.value = null
    if (!silent) sessionEndReason.value = 'Has cerrado sesión correctamente.'
  } catch (err) {
    console.error('Error en logout:', err)
    notify({ type: 'error', title: 'No se pudo cerrar sesión', message: describeAuthError(err) })
  } finally {
    loading.value = false
  }
}

// --- Observadores globales, registrados UNA sola vez al importar el módulo ---

let wasSignedIn = Boolean(auth.currentUser)

onAuthStateChanged(auth, (currentUser) => {
  const hadUser = wasSignedIn
  wasSignedIn = Boolean(currentUser)

  user.value = currentUser
  loading.value = false

  if (!authReady.value) {
    authReady.value = true
    readyResolve(currentUser)
  }

  if (currentUser) {
    // Arranca (o reanuda) la renovación automática del token de Google
    initGoogleToken()
  } else if (hadUser) {
    // La sesión se perdió sin que el usuario pulsara "Salir": token revocado,
    // cuenta deshabilitada, contraseña cambiada u otra sesión cerrada.
    clearToken()
    if (!sessionEndReason.value) {
      sessionEndReason.value = 'Tu sesión caducó o fue cerrada desde otro dispositivo. Inicia sesión de nuevo.'
      notify({
        type: 'warning',
        key: 'session-ended',
        title: 'Sesión finalizada',
        message: sessionEndReason.value,
        duration: 0
      })
    }
  }
}, (err) => {
  console.error('Error en el observador de autenticación:', err)
  error.value = describeAuthError(err)
  loading.value = false
  authReady.value = true
  readyResolve(null)
})

// Firebase renueva su ID token cada hora; si la renovación falla de forma
// persistente el usuario acaba deslogueado. Este listener nos deja detectar
// el cambio y mantener el estado sincronizado sin recargar la página.
onIdTokenChanged(auth, (currentUser) => {
  if (currentUser) user.value = currentUser
})

/** Espera a conocer el estado real de la sesión (usado por el router guard). */
export const waitForAuthReady = () => (authReady.value ? Promise.resolve(user.value) : authReadyPromise)

export function useAuth() {
  return {
    user,
    loading,
    error,
    authReady,
    sessionEndReason,
    isAuthenticated: computed(() => Boolean(user.value)),
    loginWithGoogle,
    logout
  }
}

export { user, authReady, sessionEndReason, loginWithGoogle, logout }
