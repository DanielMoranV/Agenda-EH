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
      const linked = await getDocs(query(
        collection(db, 'tareas'),
        where('user_id', '==', user.value.uid),
        where('contacto_id', '==', contactId)
      ))
      const batch = writeBatch(db)
      linked.forEach((taskDoc) => batch.update(taskDoc.ref, { contacto_id: '', notificar_responsable: false }))
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
