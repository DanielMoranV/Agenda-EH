import { ref, onMounted } from 'vue'
import { auth } from '../services/firebase/config'
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'
import { useRouter } from 'vue-router'

export function useAuth() {
  const user = ref(null)
  const loading = ref(true)
  const error = ref(null)
  const router = useRouter()

  const provider = new GoogleAuthProvider()
  // Solicitamos permisos explícitos para gestionar los eventos del calendario
  provider.addScope('https://www.googleapis.com/auth/calendar.events')

  const loginWithGoogle = async () => {
    error.value = null
    loading.value = true
    try {
      const result = await signInWithPopup(auth, provider)
      
      // Extraemos el token OAuth de Google necesario para llamar a la API REST de Calendar
      const credential = GoogleAuthProvider.credentialFromResult(result)
      const token = credential.accessToken
      if (token) {
        // Lo guardamos temporalmente en localStorage (válido por ~1 hora)
        localStorage.setItem('gcal_token', token)
      }
      
      user.value = result.user
      router.push('/') // Redirigir al dashboard tras login
    } catch (err) {
      console.error("Error en login:", err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    loading.value = true
    try {
      await signOut(auth)
      localStorage.removeItem('gcal_token')
      user.value = null
      router.push('/login')

    } catch (err) {
      console.error("Error en logout:", err)
    } finally {
      loading.value = false
    }
  }

  // Observador del estado de autenticación
  onMounted(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      user.value = currentUser
      loading.value = false
    })
    
    // Cleanup opcional si el componente se destruye, 
    // aunque onAuthStateChanged suele vivir a nivel global
  })

  return {
    user,
    loading,
    error,
    loginWithGoogle,
    logout
  }
}
