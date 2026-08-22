<script setup>
import { ref, computed, watch } from 'vue'
import { useAuth } from './composables/useAuth'
import { useFilters } from './composables/useFilters'
import { useProjects } from './composables/useProjects'
import { useContacts } from './composables/useContacts'
import { useTasks } from './composables/useTasks'
import { useNotifications } from './composables/useNotifications'
import { useRoute, useRouter } from 'vue-router'
import ToastHost from './components/ui/ToastHost.vue'
import GoogleSyncStatus from './components/ui/GoogleSyncStatus.vue'
import ThemeToggle from './components/ui/ThemeToggle.vue'
import DateRangePicker from './components/ui/DateRangePicker.vue'
import TaskFormModal from './components/matrix/TaskFormModal.vue'

const { user, authReady, logout } = useAuth()
const {
  filterStatus,
  filterProject,
  filterContact,
  filterDateType,
  filterDateRange,
  filterSingleDate
} = useFilters()
const { projects } = useProjects()
const { contacts } = useContacts()
const { addTask } = useTasks()
const { notifySuccess, notifyError } = useNotifications()
const route = useRoute()
const router = useRouter()

// Vistas que se alimentan de la barra de filtros de la cabecera
const showFilterBar = computed(() =>
  ['dashboard', 'gantt', 'indicadores'].includes(route.name)
)

// Indicadores mide los tres estados y trae su propio selector de mes: filtrar
// ahí por estado o por periodo vaciaría el indicador. Solo proyecto y
// responsable acotan lo que mide.
const showStatusAndPeriod = computed(() => route.name !== 'indicadores')

// --- Alta de tareas ---
// El modal de creación vive aquí, junto al botón que lo abre. Antes el botón
// solo levantaba un flag global (`triggerNewTask`) que cada vista tenía que
// escuchar por su cuenta: la vista Gantt nunca lo hizo, así que el botón no
// hacía nada allí y encima dejaba el flag activo, abriendo el modal solo al
// volver a la Matriz.
const isCreateModalOpen = ref(false)

const toISODate = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// La tarea nueva nace con el contexto en el que trabaja el usuario: proyecto y
// responsable filtrados y, en Gantt, una fecha dentro del periodo visible (sin
// fecha no aparecería en el diagrama, que solo muestra tareas programadas).
const newTaskDefaults = computed(() => {
  const defaults = {}
  if (filterProject.value !== 'Todos') defaults.proyecto_id = filterProject.value
  if (filterContact.value !== 'Todos') defaults.contacto_id = filterContact.value

  if (route.name === 'gantt') {
    if (filterDateType.value === 'dia' && filterSingleDate.value) {
      defaults.fecha_inicio = filterSingleDate.value
    } else if (filterDateType.value === 'rango' && filterDateRange.value.start) {
      defaults.fecha_inicio = filterDateRange.value.start
    } else {
      defaults.fecha_inicio = toISODate(new Date())
    }
  }

  return defaults
})

const createTask = async (taskData) => {
  try {
    await addTask(taskData)
    notifySuccess('Tarea creada', taskData.titulo)
  } catch (err) {
    notifyError('No se pudo crear la tarea', err.message)
  }
}

// Si la sesión se pierde en cualquier momento (caducidad, revocación, logout en
// otra pestaña), sacamos al usuario de la vista protegida al instante en lugar
// de dejarlo ante una pantalla que ya no puede cargar datos.
watch(user, (currentUser) => {
  if (!authReady.value) return
  if (!currentUser && route.meta.requiresAuth) {
    router.replace({ path: '/login', query: route.fullPath !== '/' ? { redirect: route.fullPath } : {} })
  }
})
</script>

<template>
  <div class="app-layout">
    <header v-if="user" class="corp-header glass-panel">
      <!-- Top Row: Branding, Navigation and Avatar -->
      <div class="header-top">
        <div class="brand-nav">
          <h1>Agenda EH</h1>
          <nav class="view-nav">
            <router-link to="/" class="nav-link">Matriz</router-link>
            <router-link to="/calendar" class="nav-link">Calendario</router-link>
            <router-link to="/gantt" class="nav-link">Gantt</router-link>
            <router-link to="/indicadores" class="nav-link">Indicadores</router-link>
            <router-link to="/proyectos" class="nav-link">Proyectos</router-link>
            <router-link to="/contactos" class="nav-link">Contactos</router-link>
          </nav>
        </div>
        
        <div class="header-actions">
          <div class="user-menu">
            <GoogleSyncStatus />
            <ThemeToggle />
            <img v-if="user.photoURL" :src="user.photoURL" alt="Avatar" class="user-avatar" />
            <div v-else class="avatar-placeholder"></div>
            <button @click="logout" class="logout-btn" title="Cerrar Sesión">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span class="desktop-only">Salir</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Bottom Row: Filters (Matriz, Gantt e Indicadores) -->
      <div class="header-bottom" v-if="showFilterBar">
        <div class="filters-bar">
          <div class="filters-scroll">
            <div class="filter-group" v-if="showStatusAndPeriod">
              <label>Estado:</label>
              <select v-model="filterStatus" class="corp-select">
                <option value="Todos">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En curso">En curso</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </div>

            <div class="filter-divider desktop-only" v-if="showStatusAndPeriod"></div>

            <div class="filter-group">
              <label>Proyecto:</label>
              <select v-model="filterProject" class="corp-select">
                <option value="Todos">Todos</option>
                <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
            </div>
            
            <div class="filter-divider desktop-only"></div>

            <div class="filter-group">
              <label>Responsable:</label>
              <select v-model="filterContact" class="corp-select">
                <option value="Todos">Todos</option>
                <option v-for="c in contacts" :key="c.id" :value="c.id">{{ c.nombre }}</option>
              </select>
            </div>

            <div class="filter-divider desktop-only" v-if="showStatusAndPeriod"></div>

            <div class="filter-group" v-if="showStatusAndPeriod">
              <label>Periodo:</label>
              <select v-model="filterDateType" class="corp-select">
                <option value="todos">Cualquier fecha</option>
                <option value="hoy">Hoy</option>
                <option value="esta-semana">Esta semana</option>
                <option value="este-mes">Este mes</option>
                <option value="dia">Día concreto</option>
                <option value="rango">Rango</option>
              </select>
            </div>

            <div v-if="showStatusAndPeriod && filterDateType === 'dia'" class="filter-group date-group">
              <DateRangePicker mode="single" v-model:start="filterSingleDate" />
            </div>

            <div v-if="showStatusAndPeriod && filterDateType === 'rango'" class="filter-group date-group">
              <DateRangePicker
                v-model:start="filterDateRange.start"
                v-model:end="filterDateRange.end"
              />
            </div>
          </div>
          
          <div class="filter-actions">
            <button class="btn-create" @click="isCreateModalOpen = true" title="Nueva Tarea">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span class="desktop-only">Nueva Tarea</span>
            </button>
          </div>
        </div>
      </div>
    </header>
    
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <TaskFormModal
      :is-open="isCreateModalOpen"
      :projects="projects"
      :contacts="contacts"
      :defaults="newTaskDefaults"
      @close="isCreateModalOpen = false"
      @save="createTask"
    />

    <ToastHost />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1rem;
  gap: 1rem;
  max-width: 1440px;
  margin: 0 auto;
}

/* Corporate Header */
.corp-header {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: var(--radius-md);
  position: sticky;
  top: 1rem;
  z-index: 100;
  overflow: hidden;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-color);
}

.brand-nav {
  display: flex;
  align-items: center;
  gap: 2.5rem;
}

.brand-nav h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.5px;
}

.view-nav {
  display: flex;
  gap: 0.5rem;
  background: var(--bg-base);
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.nav-link {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.9rem;
  padding: 0.4rem 1rem;
  border-radius: var(--radius-sm);
}

.nav-link:hover {
  color: var(--text-primary);
}

.nav-link.router-link-active {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
}

.avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-primary);
}

.logout-btn {
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logout-btn:hover {
  background: var(--hover-wash);
  color: var(--text-primary);
}

/* Header Bottom (Filters) */
.header-bottom {
  padding: 0.75rem 1.5rem;
  background: var(--bg-surface);
}

.filters-bar {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

/* En escritorio los filtros se reparten en varias líneas si no caben, en vez de
   esconderse tras un scroll horizontal. Al aparecer los campos de fecha
   (Rango / Día concreto) bajan a una segunda fila en bloque. */
.filters-scroll {
  display: flex;
  flex-wrap: wrap;
  column-gap: 1.25rem;
  row-gap: 0.7rem;
  align-items: center;
  /* Sin min-width:0 el contenedor se niega a encogerse por debajo de su
     contenido y empuja al botón de "Nueva Tarea" fuera de la barra. */
  min-width: 0;
  flex: 1 1 auto;
  scrollbar-width: none;
}
.filters-scroll::-webkit-scrollbar { display: none; }

/* flex:0 0 auto es lo que evita que los filtros se aplasten unos contra otros
   al aparecer los campos de fecha (Rango / Día concreto). Si pueden encogerse,
   los <select> se comprimen hasta solaparse visualmente con sus etiquetas. */
.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
}

.filter-group label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.corp-select, .corp-input {
  background: var(--bg-base);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.75rem;
  font-family: inherit;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
  flex: 0 0 auto;
  max-width: 170px;
}

/* Nombres largos de proyecto o responsable se recortan en vez de estirar la barra */
.corp-select {
  text-overflow: ellipsis;
}

.corp-select:focus, .corp-input:focus {
  border-color: var(--accent-primary);
}

.filter-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  flex: 0 0 auto;
}

.filter-actions {
  flex: 0 0 auto;
}

/* FAB and Create Button */
.btn-create {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent-primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.9rem;
  transition: var(--transition);
  white-space: nowrap;
}

.btn-create:hover {
  background: var(--accent-primary-hover);
  transform: translateY(-1px);
}

.btn-create svg {
  width: 18px;
  height: 18px;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Page Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Responsive */
@media (max-width: 768px) {
  .app-layout {
    padding: 0.6rem;
    gap: 0.6rem;
  }
  .corp-header {
    top: 0.6rem;
  }
  .header-top {
    flex-direction: column;
    gap: 0.85rem;
    align-items: stretch;
    padding: 0.85rem 1rem;
  }
  .brand-nav {
    flex-direction: column;
    align-items: stretch;
    gap: 0.85rem;
    width: 100%;
  }
  .brand-nav h1 {
    font-size: 1.15rem;
  }
  /* La navegación se desplaza horizontalmente en lugar de apretujarse */
  .view-nav {
    width: 100%;
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .view-nav::-webkit-scrollbar { display: none; }
  .nav-link {
    flex: 0 0 auto;
    white-space: nowrap;
    text-align: center;
  }
  .user-menu {
    width: 100%;
    justify-content: flex-end;
  }
  .header-bottom {
    padding: 0.6rem 1rem;
  }
  .filters-bar {
    padding-bottom: 0.25rem;
  }
  /* En móvil no hay ancho para varias filas: se desplazan horizontalmente */
  .filters-scroll {
    flex-wrap: nowrap;
    overflow-x: auto;
    column-gap: 0.9rem;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }

  .filter-group label {
    font-size: 0.68rem;
  }

  .corp-select, .corp-input {
    max-width: 130px;
    padding: 0.4rem 0.5rem;
  }

  .desktop-only { display: none; }

  .btn-create {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    padding: 0;
    justify-content: center;
    box-shadow: var(--shadow-accent);
    z-index: 1000;
  }

  .btn-create svg {
    width: 24px;
    height: 24px;
  }
}
</style>
