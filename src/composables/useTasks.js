import { ref, onUnmounted, watch } from 'vue'
import { db } from '../services/firebase/config'
import { useAuth } from './useAuth'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/googleCalendar'
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore'

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
    }, (err) => {
      console.error("Error obteniendo tareas de Firestore:", err)
      error.value = err.message
      loadingTasks.value = false
    })
  }

  watch(user, () => {
    if (unsubscribe) unsubscribe()
    subscribeToTasks()
  }, { immediate: true })

  const addTask = async (taskData) => {
    if (!user.value) throw new Error("No autenticado")
    try {
      const token = localStorage.getItem('gcal_token')
      let eventId = null

      // Si hay fechas, intentar crear el evento en Calendar primero
      if (taskData.fecha_inicio || taskData.fecha_vencimiento) {
        eventId = await createCalendarEvent(taskData, token)
      }

      await addDoc(collection(db, 'tareas'), {
        ...taskData,
        calendar_event_id: eventId || null,
        user_id: user.value.uid,
        createdAt: new Date()
      })
    } catch (err) {
      console.error("Error al añadir tarea:", err)
      throw err
    }
  }

  const updateTask = async (taskId, updates) => {
    try {
      const taskRef = doc(db, 'tareas', taskId)
      const dataToSave = { ...updates }
      
      // Buscar la tarea actual para saber si tiene calendar_event_id
      const currentTask = tasks.value.find(t => t.id === taskId)
      const token = localStorage.getItem('gcal_token')

      // Si estamos modificando fechas o textos y tiene eventId, actualizamos Calendar
      if (currentTask && currentTask.calendar_event_id) {
        await updateCalendarEvent(currentTask.calendar_event_id, { ...currentTask, ...updates }, token)
      } else if (currentTask && !currentTask.calendar_event_id && (updates.fecha_inicio || updates.fecha_vencimiento)) {
        // Si no tenía evento pero ahora le pusimos fecha, creamos uno
        const eventId = await createCalendarEvent({ ...currentTask, ...updates }, token)
        if (eventId) dataToSave.calendar_event_id = eventId
      }

      delete dataToSave.id
      await updateDoc(taskRef, dataToSave)
    } catch (err) {
      console.error("Error al actualizar tarea:", err)
      throw err
    }
  }

  const removeTask = async (taskId) => {
    try {
      const currentTask = tasks.value.find(t => t.id === taskId)
      const token = localStorage.getItem('gcal_token')
      
      if (currentTask && currentTask.calendar_event_id) {
        await deleteCalendarEvent(currentTask.calendar_event_id, token)
      }

      await deleteDoc(doc(db, 'tareas', taskId))
    } catch (err) {
      console.error("Error al eliminar tarea:", err)
      throw err
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
