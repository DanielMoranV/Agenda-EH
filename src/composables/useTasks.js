import { ref, onUnmounted, watch } from 'vue'
import { db } from '../services/firebase/config'
import { useAuth } from './useAuth'
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

  // Si el usuario cambia (ej. hace logout/login), reiniciamos la suscripción
  watch(user, () => {
    if (unsubscribe) unsubscribe()
    subscribeToTasks()
  }, { immediate: true })

  const addTask = async (taskData) => {
    if (!user.value) throw new Error("No autenticado")
    try {
      // No incluimos un id falso, Firestore lo genera
      await addDoc(collection(db, 'tareas'), {
        ...taskData,
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
      // Limpiamos el id para no guardarlo dentro del documento
      const dataToSave = { ...updates }
      delete dataToSave.id
      
      await updateDoc(taskRef, dataToSave)
    } catch (err) {
      console.error("Error al actualizar tarea:", err)
      throw err
    }
  }

  const removeTask = async (taskId) => {
    try {
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
