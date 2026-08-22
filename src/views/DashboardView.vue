<script setup>
import { ref, computed } from 'vue'
import TaskCard from '../components/matrix/TaskCard.vue'
import TaskFormModal from '../components/matrix/TaskFormModal.vue'
import { useTasks } from '../composables/useTasks'
import { useFilters } from '../composables/useFilters'
import { useProjects } from '../composables/useProjects'
import { useContacts } from '../composables/useContacts'
import { useNotifications } from '../composables/useNotifications'

// Extraemos estado y métodos de Firestore
const { tasks, updateTask, removeTask, loadingTasks } = useTasks()
const { matchesFilters } = useFilters()
const { projects } = useProjects()
const { contacts } = useContacts()
const { notifySuccess, notifyError } = useNotifications()

// --- LÓGICA DE FILTROS ---
const mobileTab = ref('q1') // Para la navegación móvil

const filteredTasks = computed(() => {
  // La lógica de filtrado vive en useFilters para que Matriz y Gantt no puedan
  // divergir (antes estaba duplicada en ambas vistas).
  const result = tasks.value.filter(matchesFilters)

  // Ordenar por fecha y hora
  return result.sort((a, b) => {
    const dateStrA = a.fecha_inicio || a.fecha_vencimiento
    const dateStrB = b.fecha_inicio || b.fecha_vencimiento
    
    // Si una no tiene fecha, enviarla al final
    if (!dateStrA && dateStrB) return 1
    if (dateStrA && !dateStrB) return -1
    if (!dateStrA && !dateStrB) return 0
    
    const timeA = a.con_hora ? (a.hora_inicio || a.hora_vencimiento || '00:00') : '00:00'
    const timeB = b.con_hora ? (b.hora_inicio || b.hora_vencimiento || '00:00') : '00:00'

    const dateA = new Date(`${dateStrA}T${timeA}:00`)
    const dateB = new Date(`${dateStrB}T${timeB}:00`)
    
    return dateA - dateB
  })
})

// Agrupamos las tareas lógicamente usando computed properties sobre la lista filtrada
const q1Tasks = computed(() => filteredTasks.value.filter(t => t.es_urgente && t.es_importante))
const q2Tasks = computed(() => filteredTasks.value.filter(t => !t.es_urgente && t.es_importante))
const q3Tasks = computed(() => filteredTasks.value.filter(t => t.es_urgente && !t.es_importante))
const q4Tasks = computed(() => filteredTasks.value.filter(t => !t.es_urgente && !t.es_importante))

// --- LÓGICA DEL MODAL ---
// Solo edición: el alta de tareas la sirve el modal de App.vue, junto al botón
// "Nueva Tarea" que lo abre.
const isModalOpen = ref(false)
const taskToEdit = ref(null)

const openEditModal = (task) => {
  taskToEdit.value = { ...task }
  isModalOpen.value = true
}

const saveTask = async (taskData) => {
  try {
    await updateTask(taskToEdit.value.id, taskData)
    notifySuccess('Tarea actualizada', taskData.titulo)
  } catch (err) {
    notifyError('No se pudo guardar la tarea', err.message)
  }
}

const deleteTask = async (task) => {
  if(confirm(`¿Eliminar la tarea "${task.titulo}"?`)) {
    try {
      await removeTask(task.id)
      notifySuccess('Tarea eliminada', task.titulo)
    } catch(err) {
      notifyError('No se pudo eliminar la tarea', err.message)
    }
  }
}

const toggleTaskStatus = async (task) => {
  const newStatus = task.estado === 'Finalizado' ? 'Pendiente' : 'Finalizado'
  try {
    await updateTask(task.id, { estado: newStatus })
  } catch (err) {
    notifyError('No se pudo cambiar el estado', err.message)
  }
}
</script>

<template>
  <div class="dashboard-view">
    
    <!-- Mobile Navigation Tabs -->
    <div class="mobile-tabs">
      <button :class="{ active: mobileTab === 'q1', 'tab-q1': mobileTab === 'q1' }" @click="mobileTab = 'q1'">
        Hacer <span class="tab-badge">{{ q1Tasks.length }}</span>
      </button>
      <button :class="{ active: mobileTab === 'q2', 'tab-q2': mobileTab === 'q2' }" @click="mobileTab = 'q2'">
        Decidir <span class="tab-badge">{{ q2Tasks.length }}</span>
      </button>
      <button :class="{ active: mobileTab === 'q3', 'tab-q3': mobileTab === 'q3' }" @click="mobileTab = 'q3'">
        Delegar <span class="tab-badge">{{ q3Tasks.length }}</span>
      </button>
      <button :class="{ active: mobileTab === 'q4', 'tab-q4': mobileTab === 'q4' }" @click="mobileTab = 'q4'">
        Eliminar <span class="tab-badge">{{ q4Tasks.length }}</span>
      </button>
    </div>

    <div class="matrix-container glass-panel">
      <div class="matrix-grid" :class="'active-tab-' + mobileTab">
        <!-- Q1 -->
        <div class="quadrant q1">
          <div class="quadrant-header">
            <div class="header-title">
              <h3>Hacer (I)</h3>
              <span class="quadrant-badge q1-badge">{{ q1Tasks.length }}</span>
            </div>
            <p>Urgente e Importante</p>
          </div>
          <div class="task-list">
            <TaskCard v-for="task in q1Tasks" :key="task.id" :task="task" :projects="projects" :contacts="contacts" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
        
        <!-- Q2 -->
        <div class="quadrant q2">
          <div class="quadrant-header">
            <div class="header-title">
              <h3>Decidir (II)</h3>
              <span class="quadrant-badge q2-badge">{{ q2Tasks.length }}</span>
            </div>
            <p>Importante, No Urgente</p>
          </div>
          <div class="task-list">
            <TaskCard v-for="task in q2Tasks" :key="task.id" :task="task" :projects="projects" :contacts="contacts" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
        
        <!-- Q3 -->
        <div class="quadrant q3">
          <div class="quadrant-header">
            <div class="header-title">
              <h3>Delegar (III)</h3>
              <span class="quadrant-badge q3-badge">{{ q3Tasks.length }}</span>
            </div>
            <p>Urgente, No Importante</p>
          </div>
          <div class="task-list">
            <TaskCard v-for="task in q3Tasks" :key="task.id" :task="task" :projects="projects" :contacts="contacts" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
        
        <!-- Q4 -->
        <div class="quadrant q4">
          <div class="quadrant-header">
            <div class="header-title">
              <h3>Eliminar (IV)</h3>
              <span class="quadrant-badge q4-badge">{{ q4Tasks.length }}</span>
            </div>
            <p>Ni Urgente Ni Importante</p>
          </div>
          <div class="task-list">
            <TaskCard v-for="task in q4Tasks" :key="task.id" :task="task" :projects="projects" :contacts="contacts" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
      </div>
    </div>

    <TaskFormModal
      :is-open="isModalOpen"
      :task="taskToEdit"
      :projects="projects"
      :contacts="contacts"
      @close="isModalOpen = false"
      @save="saveTask"
    />
  </div>
</template>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

/* --- MATRIZ --- */
.matrix-container {
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  min-height: 700px;
}

.matrix-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 1.5rem;
  height: 100%;
  flex: 1;
}

.quadrant {
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  position: relative;
}

.quadrant-header h3 {
  font-size: 1.25rem;
  position: relative;
  z-index: 1;
}

.quadrant-header p {
  font-size: 0.85rem;
  opacity: 0.8;
  margin-top: 0.25rem;
  position: relative;
  z-index: 1;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quadrant-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  min-width: 1.5rem;
}
.q1-badge { background: var(--q1-color); }
.q2-badge { background: var(--q2-color); }
.q3-badge { background: var(--q3-color); }
.q4-badge { background: var(--q4-color); }

.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;
  padding-right: 0.25rem;
  position: relative;
  z-index: 1;
}

.task-list::-webkit-scrollbar { width: 4px; }
.task-list::-webkit-scrollbar-track { background: transparent; }
.task-list::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
.task-list::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }

/* Colores de Cuadrantes */
.q1 { border-left: 4px solid var(--q1-color); }
.q1 h3 { color: var(--q1-color); }

.q2 { border-left: 4px solid var(--q2-color); }
.q2 h3 { color: var(--q2-color); }

.q3 { border-left: 4px solid var(--q3-color); }
.q3 h3 { color: var(--q3-color); }

.q4 { border-left: 4px solid var(--q4-color); }
.q4 h3 { color: var(--q4-color); }

/* --- MOBILE TABS --- */
.mobile-tabs {
  display: none;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-wash-strong);
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-left: 0.4rem;
  font-weight: 700;
}

/* Responsive */
@media (max-width: 900px) {
  .desktop-only { display: none; }

  .mobile-tabs {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    margin-top: 0.5rem;
  }
  
  .mobile-tabs::-webkit-scrollbar { display: none; }
  
  .mobile-tabs button {
    flex: 1 0 auto;
    background: var(--hover-wash);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 0.75rem 1rem;
    border-radius: 20px;
    white-space: nowrap;
    transition: all 0.2s;
    font-weight: 600;
  }
  
  .mobile-tabs button.active {
    color: white;
    box-shadow: var(--shadow-md);
  }
  
  .mobile-tabs button.tab-q1 { background: var(--q1-color); border-color: var(--q1-color); }
  .mobile-tabs button.tab-q2 { background: var(--q2-color); border-color: var(--q2-color); }
  .mobile-tabs button.tab-q3 { background: var(--q3-color); border-color: var(--q3-color); }
  .mobile-tabs button.tab-q4 { background: var(--q4-color); border-color: var(--q4-color); }

  .matrix-container {
    padding: 1rem;
    min-height: auto;
    border: none;
    background: transparent;
  }
  
  .matrix-grid {
    display: flex;
    flex-direction: column;
  }
  
  /* Ocultar todos los cuadrantes por defecto en móvil */
  .matrix-grid .quadrant {
    display: none;
    min-height: 500px;
  }
  
  /* Mostrar solo el cuadrante activo */
  .matrix-grid.active-tab-q1 .q1 { display: flex; }
  .matrix-grid.active-tab-q2 .q2 { display: flex; }
  .matrix-grid.active-tab-q3 .q3 { display: flex; }
  .matrix-grid.active-tab-q4 .q4 { display: flex; }
}
</style>
