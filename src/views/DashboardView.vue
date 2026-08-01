<script setup>
import { ref, computed, watch } from 'vue'
import TaskCard from '../components/matrix/TaskCard.vue'
import TaskFormModal from '../components/matrix/TaskFormModal.vue'
import { useTasks } from '../composables/useTasks'
import { useFilters } from '../composables/useFilters'

// Extraemos estado y métodos de Firestore
const { tasks, addTask, updateTask, removeTask, loadingTasks } = useTasks()
const { filterStatus, filterDateType, filterDateRange, triggerNewTask } = useFilters()

// Escuchar evento de crear tarea desde la barra superior (App.vue)
watch(triggerNewTask, (val) => {
  if (val) {
    openCreateModal()
    triggerNewTask.value = false
  }
})

// --- LÓGICA DE FILTROS ---
const mobileTab = ref('q1') // Para la navegación móvil

const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    // 1. Filtro por Estado
    if (filterStatus.value !== 'Todos' && task.estado !== filterStatus.value) {
      return false
    }

    // 2. Filtro por Fecha
    if (filterDateType.value === 'todos') return true

    // Si la tarea no tiene fechas, no entra en los filtros de periodo específicos
    if (!task.fecha_inicio && !task.fecha_vencimiento) return false

    let startBound, endBound;
    const now = new Date()

    if (filterDateType.value === 'hoy') {
      startBound = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      endBound = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    } else if (filterDateType.value === 'esta-semana') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Lunes como inicio
      startBound = new Date(now.getFullYear(), now.getMonth(), diff)
      endBound = new Date(startBound)
      endBound.setDate(startBound.getDate() + 6)
      endBound.setHours(23, 59, 59)
    } else if (filterDateType.value === 'este-mes') {
      startBound = new Date(now.getFullYear(), now.getMonth(), 1)
      endBound = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    } else if (filterDateType.value === 'rango') {
      if (!filterDateRange.value.start || !filterDateRange.value.end) return true
      startBound = new Date(filterDateRange.value.start + 'T00:00:00')
      endBound = new Date(filterDateRange.value.end + 'T23:59:59')
    }

    const tStart = task.fecha_inicio ? new Date(task.fecha_inicio + (task.con_hora && task.hora_inicio ? `T${task.hora_inicio}:00` : 'T00:00:00')) : null
    const tEnd = task.fecha_vencimiento ? new Date(task.fecha_vencimiento + (task.con_hora && task.hora_vencimiento ? `T${task.hora_vencimiento}:00` : 'T00:00:00')) : null

    const isStartInRange = tStart && tStart >= startBound && tStart <= endBound
    const isEndInRange = tEnd && tEnd >= startBound && tEnd <= endBound

    return isStartInRange || isEndInRange
  })
})

// Agrupamos las tareas lógicamente usando computed properties sobre la lista filtrada
const q1Tasks = computed(() => filteredTasks.value.filter(t => t.es_urgente && t.es_importante))
const q2Tasks = computed(() => filteredTasks.value.filter(t => !t.es_urgente && t.es_importante))
const q3Tasks = computed(() => filteredTasks.value.filter(t => t.es_urgente && !t.es_importante))
const q4Tasks = computed(() => filteredTasks.value.filter(t => !t.es_urgente && !t.es_importante))

// --- LÓGICA DEL MODAL ---
const isModalOpen = ref(false)
const taskToEdit = ref(null)

const openCreateModal = () => {
  taskToEdit.value = null
  isModalOpen.value = true
}

const openEditModal = (task) => {
  taskToEdit.value = { ...task }
  isModalOpen.value = true
}

const saveTask = async (taskData) => {
  try {
    if (taskToEdit.value && taskToEdit.value.id) {
      await updateTask(taskToEdit.value.id, taskData)
    } else {
      await addTask(taskData)
    }
  } catch (err) {
    alert("Hubo un error al guardar la tarea.")
  }
}

const deleteTask = async (task) => {
  if(confirm(`¿Eliminar la tarea "${task.titulo}"?`)) {
    try {
      await removeTask(task.id)
    } catch(err) {
      alert("Error al eliminar la tarea: " + err.message)
    }
  }
}

const toggleTaskStatus = async (task) => {
  const newStatus = task.estado === 'Finalizado' ? 'Pendiente' : 'Finalizado'
  try {
    await updateTask(task.id, { estado: newStatus })
  } catch (err) {
    console.error("Error toggle status", err)
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
            <TaskCard v-for="task in q1Tasks" :key="task.id" :task="task" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
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
            <TaskCard v-for="task in q2Tasks" :key="task.id" :task="task" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
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
            <TaskCard v-for="task in q3Tasks" :key="task.id" :task="task" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
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
            <TaskCard v-for="task in q4Tasks" :key="task.id" :task="task" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
      </div>
    </div>

    <TaskFormModal 
      :is-open="isModalOpen"
      :task="taskToEdit"
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
.task-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
.task-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

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
  background: rgba(255, 255, 255, 0.15);
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
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--text-secondary);
    padding: 0.75rem 1rem;
    border-radius: 20px;
    white-space: nowrap;
    transition: all 0.2s;
    font-weight: 600;
  }
  
  .mobile-tabs button.active {
    color: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
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
