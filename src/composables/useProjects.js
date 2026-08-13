import { ref, onUnmounted, watch } from 'vue'
import { db } from '../services/firebase/config'
import { useAuth } from './useAuth'
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
  doc 
} from 'firebase/firestore'

export function useProjects() {
  const projects = ref([])
  const loadingProjects = ref(true)
  const error = ref(null)
  
  const { user } = useAuth()
  let unsubscribe = null

  const subscribeToProjects = () => {
    if (!user.value) {
      projects.value = []
      loadingProjects.value = false
      return
    }

    loadingProjects.value = true
    const q = query(
      collection(db, 'proyectos'), 
      where('user_id', '==', user.value.uid)
    )

    unsubscribe = onSnapshot(q, (querySnapshot) => {
      const projectsData = []
      querySnapshot.forEach((document) => {
        projectsData.push({ id: document.id, ...document.data() })
      })
      projects.value = projectsData
      loadingProjects.value = false
    }, (err) => {
      console.error("Error obteniendo proyectos de Firestore:", err)
      error.value = describeFirestoreError(err)
      loadingProjects.value = false
      notify({
        type: 'error',
        key: 'projects-stream-error',
        title: 'No se pudieron cargar los proyectos',
        message: error.value,
        duration: 0
      })
    })
  }

  watch(user, () => {
    if (unsubscribe) unsubscribe()
    subscribeToProjects()
  }, { immediate: true })

  const addProject = async (projectData) => {
    if (!user.value) throw new Error("No autenticado")
    try {
      await addDoc(collection(db, 'proyectos'), {
        ...projectData,
        user_id: user.value.uid,
        createdAt: new Date()
      })
    } catch (err) {
      console.error("Error al añadir proyecto:", err)
      throw err
    }
  }

  const updateProject = async (projectId, updates) => {
    try {
      const projectRef = doc(db, 'proyectos', projectId)
      const dataToSave = { ...updates }
      delete dataToSave.id
      await updateDoc(projectRef, dataToSave)
    } catch (err) {
      console.error("Error al actualizar proyecto:", err)
      throw err
    }
  }

  const removeProject = async (projectId) => {
    try {
      await deleteDoc(doc(db, 'proyectos', projectId))
    } catch (err) {
      console.error("Error al eliminar proyecto:", err)
      throw err
    }
  }

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  return {
    projects,
    loadingProjects,
    error,
    addProject,
    updateProject,
    removeProject
  }
}
