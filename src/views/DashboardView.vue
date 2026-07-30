<script setup>
import { ref, computed } from 'vue'
import TaskCard from '../components/matrix/TaskCard.vue'
import TaskFormModal from '../components/matrix/TaskFormModal.vue'
import { useTasks } from '../composables/useTasks'

// Extraemos estado y métodos de Firestore
const { tasks, addTask, updateTask, removeTask, loadingTasks } = useTasks()

// Agrupamos las tareas lógicamente usando computed properties
const q1Tasks = computed(() => tasks.value.filter(t => t.es_urgente && t.es_importante))
const q2Tasks = computed(() => tasks.value.filter(t => !t.es_urgente && t.es_importante))
const q3Tasks = computed(() => tasks.value.filter(t => t.es_urgente && !t.es_importante))
const q4Tasks = computed(() => tasks.value.filter(t => !t.es_urgente && !t.es_importante))

// --- LÓGICA DEL MODAL ---
const isModalOpen = ref(false)
const taskToEdit = ref(null)

const openCreateModal = () => {
  taskToEdit.value = null
  isModalOpen.value = true
}

const openEditModal = (task) => {
  taskToEdit.value = { ...task } // clonamos para evitar reactividad indeseada en edición
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
      alert("Error al eliminar la tarea.")
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
    <header class="dashboard-header">
      <div class="header-titles">
        <h2>Matriz de Eisenhower</h2>
        <p class="subtitle">Clasifica y domina tu tiempo de forma dinámica.</p>
      </div>
      <button class="btn-create" @click="openCreateModal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Nueva Tarea
      </button>
    </header>
    
    <div class="matrix-container glass-panel">
      <div class="matrix-grid">
        <!-- Q1 -->
        <div class="quadrant q1">
          <div class="quadrant-header">
            <h3>Hacer (I)</h3>
            <p>Urgente e Importante</p>
          </div>
          <div class="task-list">
            <TaskCard v-for="task in q1Tasks" :key="task.id" :task="task" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
        
        <!-- Q2 -->
        <div class="quadrant q2">
          <div class="quadrant-header">
            <h3>Decidir (II)</h3>
            <p>Importante, No Urgente</p>
          </div>
          <div class="task-list">
            <TaskCard v-for="task in q2Tasks" :key="task.id" :task="task" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
        
        <!-- Q3 -->
        <div class="quadrant q3">
          <div class="quadrant-header">
            <h3>Delegar (III)</h3>
            <p>Urgente, No Importante</p>
          </div>
          <div class="task-list">
            <TaskCard v-for="task in q3Tasks" :key="task.id" :task="task" @edit="openEditModal" @delete="deleteTask" @toggle-status="toggleTaskStatus" />
          </div>
        </div>
        
        <!-- Q4 -->
        <div class="quadrant q4">
          <div class="quadrant-header">
            <h3>Eliminar (IV)</h3>
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
  gap: 1.5rem;
  height: 100%;
}

.dashboard-header {
  padding: 0 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h2 {
  font-size: 2rem;
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-top: 0.25rem;
}

.btn-create {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent-primary);
  color: white;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: var(--transition);
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
}

.btn-create:hover {
  background: var(--accent-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.6);
}

.btn-create svg {
  width: 20px;
  height: 20px;
}

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
  border-radius: var(--radius-md);
  padding: 1.25rem;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
}

.quadrant-header h3 {
  font-size: 1.25rem;
}

.quadrant-header p {
  font-size: 0.85rem;
  opacity: 0.8;
  margin-top: 0.25rem;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;
  padding-right: 0.25rem;
}

/* Custom Scrollbar for task lists */
.task-list::-webkit-scrollbar { width: 4px; }
.task-list::-webkit-scrollbar-track { background: transparent; }
.task-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
.task-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* Quadrant Styles */
.q1 { background: var(--q1-bg); border-top: 4px solid var(--q1-color); }
.q1 h3 { color: var(--q1-color); }

.q2 { background: var(--q2-bg); border-top: 4px solid var(--q2-color); }
.q2 h3 { color: var(--q2-color); }

.q3 { background: var(--q3-bg); border-top: 4px solid var(--q3-color); }
.q3 h3 { color: var(--q3-color); }

.q4 { background: var(--q4-bg); border-top: 4px solid var(--q4-color); }
.q4 h3 { color: var(--q4-color); }

/* Responsive adjustments (RNF-04) */
@media (max-width: 900px) {
  .matrix-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
  
  .matrix-container {
    padding: 1rem;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>
