import { ref, watch } from 'vue'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { user } from './useAuth'
import { notify } from './useNotifications'
import { describeFirestoreError } from '../services/firebase/errors'

/**
 * Suscripción ÚNICA (compartida por toda la app) a una colección del usuario.
 *
 * Antes cada llamada a useTasks()/useProjects()/useContacts() abría su propio
 * onSnapshot, así que App.vue + la vista activa duplicaban las lecturas de
 * Firestore. Ahora hay un listener por colección que sigue al usuario y se
 * reinicia solo al iniciar/cerrar sesión.
 */
export const createCollectionStore = ({ collectionName, errorKey, errorTitle }) => {
  const items = ref([])
  const loading = ref(true)
  const error = ref(null)
  let unsubscribe = null

  const subscribe = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }

    if (!user.value) {
      items.value = []
      loading.value = false
      return
    }

    loading.value = true
    error.value = null
    const q = query(collection(db, collectionName), where('user_id', '==', user.value.uid))

    unsubscribe = onSnapshot(q, (snapshot) => {
      items.value = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
      loading.value = false
      error.value = null
    }, (err) => {
      console.error(`Error obteniendo ${collectionName} de Firestore:`, err)
      error.value = describeFirestoreError(err)
      loading.value = false
      notify({
        type: 'error',
        key: errorKey,
        title: errorTitle,
        message: error.value,
        duration: 0
      })
    })
  }

  watch(() => user.value?.uid, subscribe, { immediate: true })

  return { items, loading, error }
}
