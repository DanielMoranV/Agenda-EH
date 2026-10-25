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

const { items: contacts, loading: loadingContacts, error } = createCollectionStore({
  collectionName: 'contactos',
  errorKey: 'contacts-stream-error',
  errorTitle: 'No se pudieron cargar los contactos'
})

export function useContacts() {
  const { user } = useAuth()

  const addContact = async (contactData) => {
    if (!user.value) throw new Error("No autenticado")
    try {
      await addDoc(collection(db, 'contactos'), {
        ...contactData,
        user_id: user.value.uid,
        createdAt: new Date()
      })
    } catch (err) {
      console.error("Error al añadir contacto:", err)
      throw err
    }
  }

  const updateContact = async (contactId, updates) => {
    try {
      const contactRef = doc(db, 'contactos', contactId)
      const dataToSave = { ...updates }
      delete dataToSave.id
      await updateDoc(contactRef, dataToSave)
    } catch (err) {
      console.error("Error al actualizar contacto:", err)
      throw err
    }
  }

  const removeContact = async (contactId) => {
    try {
      // Las tareas que apuntaban a este registro quedarían con un id colgante:
      // las desvinculamos en el mismo lote que el borrado.
      // Se leen las tareas del usuario (solo por user_id, sin índices extra) y se
      // filtra aquí: el contacto puede ser responsable o ir en copia.
      const mine = await getDocs(query(
        collection(db, 'tareas'),
        where('user_id', '==', user.value.uid)
      ))
      const batch = writeBatch(db)
      mine.forEach((taskDoc) => {
        const task = taskDoc.data()
        const wasResponsible = task.contacto_id === contactId
        const copies = task.contactos_copia_ids || []
        if (!wasResponsible && !copies.includes(contactId)) return

        const remainingCopies = copies.filter((id) => id !== contactId)
        const stillHasResponsible = Boolean(task.contacto_id) && !wasResponsible
        const changes = { contactos_copia_ids: remainingCopies }
        if (wasResponsible) changes.contacto_id = ''
        // Sin nadie a quien avisar, el aviso por correo deja de tener sentido
        if (!stillHasResponsible && remainingCopies.length === 0) changes.notificar_responsable = false
        batch.update(taskDoc.ref, changes)
      })
      batch.delete(doc(db, 'contactos', contactId))
      await batch.commit()
    } catch (err) {
      console.error("Error al eliminar contacto:", err)
      throw err
    }
  }

  return {
    contacts,
    loadingContacts,
    error,
    addContact,
    updateContact,
    removeContact
  }
}
