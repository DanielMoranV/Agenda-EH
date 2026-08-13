import { ref, onUnmounted, watch } from 'vue'
import { db } from '../services/firebase/config'
import { useAuth } from './useAuth'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/googleCalendar'
import { sendTaskNotificationEmail } from '../services/gmail'
import { GoogleAuthRequiredError, describeGoogleApiError } from '../services/google/apiClient'
import { notify } from './useNotifications'
import { describeFirestoreError } from '../services/firebase/errors'
import {
  collection,
  query,
  where,
  onSnapshot,
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

export function useTasks() {
  const tasks = ref([])
  const loadingTasks = ref(true)
  const error = ref(null)

  const { user } = useAuth()
  let unsubscribe = null

  const subscribeToTasks = () => {
    if (!user.value) {
      tasks.value = []
      loadingTasks.value = false
      return
    }

    loadingTasks.value = true
    error.value = null
    const q = query(
      collection(db, 'tareas'),
      where('user_id', '==', user.value.uid)
    )

    // onSnapshot mantiene los datos sincronizados en tiempo real
    unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasksData = []
      querySnapshot.forEach((document) => {
        tasksData.push({ id: document.id, ...document.data() })
      })
      tasks.value = tasksData
      loadingTasks.value = false
      error.value = null
    }, (err) => {
      console.error('Error obteniendo tareas de Firestore:', err)
      error.value = describeFirestoreError(err)
      loadingTasks.value = false
      notify({
        type: 'error',
        key: 'tasks-stream-error',
        title: 'No se pudieron cargar las tareas',
        message: error.value,
        duration: 0
      })
    })
  }

  watch(user, () => {
    if (unsubscribe) unsubscribe()
    subscribeToTasks()
  }, { immediate: true })

  /** Envía el correo de notificación al responsable. Nunca bloquea el guardado. */
  const notifyAssignee = async (taskData, contactId) => {
    if (!contactId) return

    try {
      const contactSnapshot = await getDoc(doc(db, 'contactos', contactId))
      if (!contactSnapshot.exists()) {
        notify({ type: 'warning', title: 'No se envió el correo', message: 'El contacto asignado ya no existe.' })
        return
      }
      const contactData = contactSnapshot.data()
      if (!contactData.email) {
        notify({ type: 'warning', title: 'No se envió el correo', message: `${contactData.nombre || 'El contacto'} no tiene email registrado.` })
        return
      }

      const result = await syncWithGoogle(
        () => sendTaskNotificationEmail(taskData, contactData),
        { context: `El aviso por correo a ${contactData.nombre || contactData.email}` }
      )
      if (result.ok) {
        notify({ type: 'success', title: 'Aviso enviado', message: `Se notificó por correo a ${contactData.nombre || contactData.email}.` })
      }
    } catch (err) {
      console.error('No se pudo preparar la notificación por correo:', err)
      notify({ type: 'warning', title: 'No se envió el correo', message: describeFirestoreError(err) })
    }
  }

  const addTask = async (taskData) => {
    if (!user.value) throw new Error('No autenticado')

    // 1) Guardar SIEMPRE en Firestore primero: es la fuente de verdad.
    let docRef
    try {
      docRef = await addDoc(collection(db, 'tareas'), {
        ...taskData,
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
    if (taskData.notificar_responsable && taskData.contacto_id) {
      await notifyAssignee(taskData, taskData.contacto_id)
    }

    return docRef.id
  }

  const updateTask = async (taskId, updates) => {
    const currentTask = tasks.value.find(t => t.id === taskId)
    const dataToSave = { ...updates }
    delete dataToSave.id

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

      if (currentTask.calendar_event_id) {
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

    // 3) Notificación por correo. Se comprueba sobre `updates` (no sobre la tarea
    // combinada) para no reenviar el aviso en cada cambio de estado o arrastre
    // en el calendario, donde el flag ni siquiera viene en la actualización.
    if (updates.notificar_responsable && updates.contacto_id) {
      await notifyAssignee({ ...currentTask, ...updates }, updates.contacto_id)
    }
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

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  return {
    tasks,
    loadingTasks,
    error,
    addTask,
    updateTask,
    removeTask
  }
}
