import { db } from '../services/firebase/config'
import { useAuth } from './useAuth'
import { createCollectionStore } from './createCollectionStore'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/googleCalendar'
import { sendTaskNotificationEmail } from '../services/gmail'
import { GoogleAuthRequiredError, describeGoogleApiError } from '../services/google/apiClient'
import { notify } from './useNotifications'
import { describeFirestoreError } from '../services/firebase/errors'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore'

/**
 * Ejecuta una sincronización con Google sin que su fallo tumbe la operación
 * principal (que ya se guardó en Firestore). Devuelve el resultado o null.
 *
 * Este es el cambio de diseño clave: antes, si el token de Google había
 * caducado, createCalendarEvent lanzaba y la tarea NUNCA llegaba a Firestore,
 * así que el usuario perdía lo que acababa de escribir. Ahora Firestore es la
 * fuente de verdad y Calendar/Gmail son un efecto secundario best-effort.
 */
const syncWithGoogle = async (operation, { context }) => {
  try {
    return { ok: true, value: await operation() }
  } catch (err) {
    if (err instanceof GoogleAuthRequiredError) {
      // useGoogleToken ya mostró el aviso persistente con el botón "Reconectar".
      notify({
        type: 'warning',
        key: 'google-sync-paused',
        title: 'Sincronización con Google pausada',
        message: `${context} se guardó en la agenda, pero no se pudo reflejar en Google hasta que reconectes.`
      })
    } else {
      console.error(`Fallo sincronizando con Google (${context}):`, err)
      notify({
        type: 'warning',
        title: 'No se pudo sincronizar con Google',
        message: `${context}: ${describeGoogleApiError(err)}`
      })
    }
    return { ok: false, error: err }
  }
}

// "YYYY-MM-DD" de hoy en horario local (es lo que comparan los indicadores)
const todayISO = () => {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const { items: tasks, loading: loadingTasks, error } = createCollectionStore({
  collectionName: 'tareas',
  errorKey: 'tasks-stream-error',
  errorTitle: 'No se pudieron cargar las tareas'
})

export function useTasks() {
  const { user } = useAuth()

  /** Claves "rol:id" de quienes deben recibir aviso según el estado de la tarea. */
  const recipientKeys = (task) => {
    const keys = new Set()
    if (!task?.notificar_responsable) return keys
    if (task.contacto_id) keys.add(`responsable:${task.contacto_id}`)
    ;(task.contactos_copia_ids || []).forEach((id) => {
      // Si además es el responsable, ya recibe el aviso como tal
      if (id && id !== task.contacto_id) keys.add(`copia:${id}`)
    })
    return keys
  }

  /**
   * Envía un correo por destinatario (responsable y copias). Nunca bloquea el
   * guardado: los problemas se avisan por notificación y el resto sigue.
   */
  const notifyRecipients = async (taskData, keys) => {
    if (!keys.length) return

    // Quien lleva la tarea, para decírselo a los que van en copia
    let assigneeName = ''
    if (taskData.contacto_id) {
      try {
        const snap = await getDoc(doc(db, 'contactos', taskData.contacto_id))
        if (snap.exists()) assigneeName = snap.data().nombre || ''
      } catch { /* solo afecta al texto del correo */ }
    }

    const sent = []
    for (const key of keys) {
      const [role, contactId] = key.split(':')
      try {
        const snap = await getDoc(doc(db, 'contactos', contactId))
        if (!snap.exists()) {
          notify({ type: 'warning', title: 'No se envió el correo', message: 'Un contacto del aviso ya no existe.' })
          continue
        }
        const contactData = snap.data()
        const label = contactData.nombre || contactData.email || 'el contacto'
        if (!contactData.email) {
          notify({ type: 'warning', title: 'No se envió el correo', message: `${label} no tiene email registrado.` })
          continue
        }

        const result = await syncWithGoogle(
          () => sendTaskNotificationEmail(taskData, contactData, { role, assigneeName }),
          { context: `El aviso por correo a ${label}` }
        )
        if (result.ok) {
          sent.push(label)
        } else if (result.error instanceof GoogleAuthRequiredError) {
          break // sin autorización de Google, el resto fallaría igual
        }
      } catch (err) {
        console.error('No se pudo preparar la notificación por correo:', err)
        notify({ type: 'warning', title: 'No se envió el correo', message: describeFirestoreError(err) })
      }
    }

    if (sent.length) {
      notify({ type: 'success', title: 'Aviso enviado', message: `Se notificó por correo a ${sent.join(', ')}.` })
    }
  }

  const addTask = async (taskData) => {
    if (!user.value) throw new Error('No autenticado')

    // 1) Guardar SIEMPRE en Firestore primero: es la fuente de verdad.
    let docRef
    try {
      docRef = await addDoc(collection(db, 'tareas'), {
        ...taskData,
        finalizado_at: taskData.estado === 'Finalizado' ? todayISO() : null,
        calendar_event_id: null,
        user_id: user.value.uid,
        createdAt: new Date()
      })
    } catch (err) {
      console.error('Error al añadir tarea:', err)
      throw new Error(describeFirestoreError(err))
    }

    // 2) Sincronizar con Calendar como efecto secundario (no crítico).
    if (taskData.fecha_inicio || taskData.fecha_vencimiento) {
      const result = await syncWithGoogle(
        () => createCalendarEvent(taskData),
        { context: `La tarea "${taskData.titulo}"` }
      )
      if (result.ok && result.value) {
        try {
          await updateDoc(docRef, { calendar_event_id: result.value })
        } catch (err) {
          console.error('No se pudo guardar el ID del evento de Calendar:', err)
        }
      }
    }

    // 3) Notificación por correo (tampoco crítica).
    await notifyRecipients(taskData, [...recipientKeys(taskData)])

    return docRef.id
  }

  const updateTask = async (taskId, updates) => {
    const currentTask = tasks.value.find(t => t.id === taskId)
    const dataToSave = { ...updates }
    delete dataToSave.id

    // Fecha de finalización (para medir entregas a tiempo): se fija al pasar a
    // Finalizado y se borra si la tarea se reabre. Si ya estaba finalizada se respeta.
    if ('estado' in updates) {
      if (updates.estado === 'Finalizado') {
        // Solo al PASAR a Finalizado: una tarea ya cerrada antes de que existiera
        // el registro queda "sin registro" en vez de inventar una fecha.
        if (currentTask?.estado !== 'Finalizado') dataToSave.finalizado_at = todayISO()
      } else {
        dataToSave.finalizado_at = null
      }
    }

    // 1) Persistir en Firestore primero.
    try {
      await updateDoc(doc(db, 'tareas', taskId), dataToSave)
    } catch (err) {
      console.error('Error al actualizar tarea:', err)
      throw new Error(describeFirestoreError(err))
    }

    // 2) Reflejar el cambio en Google Calendar.
    if (currentTask) {
      const merged = { ...currentTask, ...updates }
      const label = `La tarea "${merged.titulo}"`

      if (currentTask.calendar_event_id && !merged.fecha_inicio && !merged.fecha_vencimiento) {
        // Se quitaron todas las fechas: el evento ya no tiene sentido (y Google
        // rechazaría un PUT sin start/end), así que lo borramos y soltamos el ID.
        const result = await syncWithGoogle(
          () => deleteCalendarEvent(currentTask.calendar_event_id),
          { context: label }
        )
        if (result.ok) {
          try {
            await updateDoc(doc(db, 'tareas', taskId), { calendar_event_id: null })
          } catch (err) {
            console.error('No se pudo limpiar el ID del evento de Calendar:', err)
          }
        }
      } else if (currentTask.calendar_event_id) {
        const result = await syncWithGoogle(
          () => updateCalendarEvent(currentTask.calendar_event_id, merged),
          { context: label }
        )
        // Si el evento había sido borrado en Google, updateCalendarEvent lo recrea
        if (result.ok && result.value?.recreated && result.value.eventId) {
          try {
            await updateDoc(doc(db, 'tareas', taskId), { calendar_event_id: result.value.eventId })
          } catch (err) {
            console.error('No se pudo guardar el nuevo ID del evento de Calendar:', err)
          }
        }
      } else if (merged.fecha_inicio || merged.fecha_vencimiento) {
        // No tenía evento (o falló al crearse antes) y ahora tiene fecha: lo creamos.
        const result = await syncWithGoogle(
          () => createCalendarEvent(merged),
          { context: label }
        )
        if (result.ok && result.value) {
          try {
            await updateDoc(doc(db, 'tareas', taskId), { calendar_event_id: result.value })
          } catch (err) {
            console.error('No se pudo guardar el ID del evento de Calendar:', err)
          }
        }
      }
    }

    // 3) Notificación por correo. Solo reaccionamos si la actualización toca los
    // campos del aviso, y avisamos únicamente a quien NO lo había recibido ya
    // (nuevo destinatario, rol distinto o aviso recién activado): así editar el
    // título o arrastrar en el calendario no reenvía nada.
    const touchesRecipients = ['notificar_responsable', 'contacto_id', 'contactos_copia_ids']
      .some((field) => field in updates)
    if (touchesRecipients) {
      const alreadyNotified = recipientKeys(currentTask)
      const pending = [...recipientKeys({ ...currentTask, ...updates })]
        .filter((key) => !alreadyNotified.has(key))
      await notifyRecipients({ ...currentTask, ...updates }, pending)
    }
  }

  /**
   * Envío manual (o reenvío) del aviso a todos los destinatarios de la tarea,
   * con independencia de si ya se avisó o del interruptor del formulario.
   */
  const sendNotifications = async (taskId) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return

    const keys = []
    if (task.contacto_id) keys.push(`responsable:${task.contacto_id}`)
    ;(task.contactos_copia_ids || []).forEach((id) => {
      if (id && id !== task.contacto_id) keys.push(`copia:${id}`)
    })

    if (!keys.length) {
      notify({ type: 'info', title: 'Sin destinatarios', message: 'La tarea no tiene responsable ni contactos en copia.' })
      return
    }
    await notifyRecipients(task, keys)
  }

  /** Pide confirmación (nombrando a los destinatarios) y envía el aviso. */
  const confirmAndSendNotifications = async (task, contacts = []) => {
    const ids = [task.contacto_id, ...(task.contactos_copia_ids || [])].filter(Boolean)
    const names = [...new Set(ids)]
      .map(id => contacts.find(c => c.id === id)?.nombre)
      .filter(Boolean)
    const who = names.length ? names.join(', ') : 'los destinatarios'

    if (!confirm(`¿Enviar el aviso de "${task.titulo}" por correo a ${who}?`)) return
    await sendNotifications(task.id)
  }

  const removeTask = async (taskId) => {
    const currentTask = tasks.value.find(t => t.id === taskId)

    // Borramos primero en Google: si Calendar falla, avisamos pero seguimos,
    // porque dejar la tarea en la agenda tras pulsar "Eliminar" confunde más.
    if (currentTask?.calendar_event_id) {
      await syncWithGoogle(
        () => deleteCalendarEvent(currentTask.calendar_event_id),
        { context: `El evento de "${currentTask.titulo}"` }
      )
    }

    try {
      await deleteDoc(doc(db, 'tareas', taskId))
    } catch (err) {
      console.error('Error al eliminar tarea:', err)
      throw new Error(describeFirestoreError(err))
    }
  }

  return {
    tasks,
    loadingTasks,
    error,
    addTask,
    updateTask,
    sendNotifications,
    confirmAndSendNotifications,
    removeTask
  }
}
