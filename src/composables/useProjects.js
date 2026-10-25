import { db } from '../services/firebase/config'
import { useAuth } from './useAuth'
import { createCollectionStore } from './createCollectionStore'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore'

const { items: projects, loading: loadingProjects, error } = createCollectionStore({
  collectionName: 'proyectos',
  errorKey: 'projects-stream-error',
  errorTitle: 'No se pudieron cargar los proyectos'
})

export function useProjects() {
  const { user } = useAuth()

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
      // Las tareas que apuntaban a este registro quedarían con un id colgante:
      // las desvinculamos en el mismo lote que el borrado.
      const linked = await getDocs(query(
        collection(db, 'tareas'),
        where('user_id', '==', user.value.uid),
        where('proyecto_id', '==', projectId)
      ))
      const batch = writeBatch(db)
      linked.forEach((taskDoc) => batch.update(taskDoc.ref, { proyecto_id: '' }))
      batch.delete(doc(db, 'proyectos', projectId))
      await batch.commit()
    } catch (err) {
      console.error("Error al eliminar proyecto:", err)
      throw err
    }
  }

  return {
    projects,
    loadingProjects,
    error,
    addProject,
    updateProject,
    removeProject
  }
}
