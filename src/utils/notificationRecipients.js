/**
 * Claves "rol:id" de quienes deben recibir el aviso por correo de una tarea.
 * Vacío si el aviso está desactivado. El responsable no se repite como copia.
 */
export const recipientKeys = (task) => {
  const keys = new Set()
  if (!task?.notificar_responsable) return keys
  if (task.contacto_id) keys.add(`responsable:${task.contacto_id}`)
  ;(task.contactos_copia_ids || []).forEach((id) => {
    // Si además es el responsable, ya recibe el aviso como tal
    if (id && id !== task.contacto_id) keys.add(`copia:${id}`)
  })
  return keys
}

/** Claves de aviso que aún no se habían enviado al pasar de `before` a `after`. */
export const pendingRecipientKeys = (before, after) => {
  const already = recipientKeys(before)
  return [...recipientKeys(after)].filter((key) => !already.has(key))
}
