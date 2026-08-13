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

export function useContacts() {
  const contacts = ref([])
  const loadingContacts = ref(true)
  const error = ref(null)
  
  const { user } = useAuth()
  let unsubscribe = null

  const subscribeToContacts = () => {
    if (!user.value) {
      contacts.value = []
      loadingContacts.value = false
      return
    }

    loadingContacts.value = true
    const q = query(
      collection(db, 'contactos'), 
      where('user_id', '==', user.value.uid)
    )

    unsubscribe = onSnapshot(q, (querySnapshot) => {
      const contactsData = []
      querySnapshot.forEach((document) => {
        contactsData.push({ id: document.id, ...document.data() })
      })
      contacts.value = contactsData
      loadingContacts.value = false
    }, (err) => {
      console.error("Error obteniendo contactos de Firestore:", err)
      error.value = describeFirestoreError(err)
      loadingContacts.value = false
      notify({
        type: 'error',
        key: 'contacts-stream-error',
        title: 'No se pudieron cargar los contactos',
        message: error.value,
        duration: 0
      })
    })
  }

  watch(user, () => {
    if (unsubscribe) unsubscribe()
    subscribeToContacts()
  }, { immediate: true })

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
      await deleteDoc(doc(db, 'contactos', contactId))
    } catch (err) {
      console.error("Error al eliminar contacto:", err)
      throw err
    }
  }

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  return {
    contacts,
    loadingContacts,
    error,
    addContact,
    updateContact,
    removeContact
  }
}
