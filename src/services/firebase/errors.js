// Traducción de códigos de error de Firestore a mensajes accionables.
// Especialmente importante para 'permission-denied' y 'unauthenticated', que
// son la señal de que la sesión caducó o de que las reglas rechazan la consulta.

const FIRESTORE_MESSAGES = {
  'permission-denied': 'No tienes permiso para esta operación. Puede que tu sesión haya caducado: cierra sesión y vuelve a entrar.',
  'unauthenticated': 'Tu sesión caducó. Inicia sesión de nuevo para continuar.',
  'unavailable': 'Sin conexión con la base de datos. Los cambios se sincronizarán cuando vuelva la conexión.',
  'deadline-exceeded': 'La operación tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.',
  'not-found': 'El elemento ya no existe. Puede que se haya eliminado desde otro dispositivo.',
  'already-exists': 'Ese elemento ya existe.',
  'resource-exhausted': 'Se alcanzó el límite de uso de la base de datos. Inténtalo más tarde.',
  'failed-precondition': 'La operación no se puede completar en el estado actual de los datos.',
  'aborted': 'La operación se canceló por un conflicto con otro cambio. Inténtalo de nuevo.',
  'cancelled': 'La operación fue cancelada.',
  'invalid-argument': 'Los datos enviados no son válidos.',
  'internal': 'Error interno del servidor. Inténtalo de nuevo en unos momentos.'
}

export const describeFirestoreError = (err) => {
  const code = (err?.code || '').replace('firestore/', '')
  return FIRESTORE_MESSAGES[code] || err?.message || 'Error inesperado al acceder a los datos.'
}

/** ¿El error indica que la sesión ya no es válida? */
export const isAuthFirestoreError = (err) => {
  const code = (err?.code || '').replace('firestore/', '')
  return code === 'permission-denied' || code === 'unauthenticated'
}
