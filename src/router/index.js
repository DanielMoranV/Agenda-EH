import { createRouter, createWebHistory } from 'vue-router'
import { waitForAuthReady } from '../composables/useAuth'
import DashboardView from '../views/DashboardView.vue'
import LoginView from '../views/LoginView.vue'
import CalendarView from '../views/CalendarView.vue'
import ContactosView from '../views/ContactosView.vue'
import ProyectosView from '../views/ProyectosView.vue'
import GanttView from '../views/GanttView.vue'
import IndicadoresView from '../views/IndicadoresView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/gantt',
      name: 'gantt',
      component: GanttView,
      meta: { requiresAuth: true }
    },
    {
      path: '/indicadores',
      name: 'indicadores',
      component: IndicadoresView,
      meta: { requiresAuth: true }
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: CalendarView,
      meta: { requiresAuth: true }
    },
    {
      path: '/contactos',
      name: 'contactos',
      component: ContactosView,
      meta: { requiresAuth: true }
    },
    {
      path: '/proyectos',
      name: 'proyectos',
      component: ProyectosView,
      meta: { requiresAuth: true }
    }
  ]
})

// Navigation Guard para proteger rutas.
// Reutiliza el observador global de useAuth en lugar de suscribirse a Firebase
// en cada navegación (antes se creaba un listener nuevo por cada cambio de ruta).
router.beforeEach(async (to) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)
  const currentUser = await waitForAuthReady()

  if (requiresAuth && !currentUser) {
    // Guardamos el destino para volver a él tras iniciar sesión
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  if (requiresGuest && currentUser) {
    return '/'
  }

  // No retornar nada equivale a permitir la navegación
})

export default router
