<script setup>
import { computed } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  },
  projects: {
    type: Array,
    default: () => []
  },
  contacts: {
    type: Array,
    default: () => []
  }
})

defineEmits(['edit', 'delete', 'toggle-status'])

// Damos formato a la fecha si existe (soporta timestamp de Firestore o Date de JS)
const formattedDate = computed(() => {
  const dateObj = props.task.fecha_vencimiento || props.task.fecha_inicio
  if (!dateObj) return null

  // Ensure it doesn't shift days by forcing time if it's a string
  const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj + 'T00:00:00')
  let dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  if (props.task.con_hora) {
    const timeObj = props.task.hora_vencimiento || props.task.hora_inicio
    if (timeObj) {
      let [hours, minutes] = timeObj.split(':')
      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12 || 12
      dateStr += ` a las ${hours}:${minutes} ${ampm}`
    }
  }

  return dateStr
})

const isDone = computed(() => props.task.estado === 'Finalizado')

const projectName = computed(() => {
  if (!props.task.proyecto_id) return null
  const project = props.projects.find(p => p.id === props.task.proyecto_id)
  return project ? project.nombre : null
})

const contactName = computed(() => {
  if (!props.task.contacto_id) return null
  const contact = props.contacts.find(c => c.id === props.task.contacto_id)
  return contact ? contact.nombre : null
})
</script>

<template>
  <div class="task-card" :class="{ 'is-done': isDone }">
    <div class="task-header">
      <label class="custom-checkbox">
        <input 
          type="checkbox" 
          :checked="isDone" 
          @change="$emit('toggle-status', task)"
        >
        <span class="checkmark"></span>
      </label>
      <h4 class="task-title" :title="task.titulo">{{ task.titulo }}</h4>
      <div class="task-actions">
        <button class="icon-btn edit-btn" @click="$emit('edit', task)" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="icon-btn delete-btn" @click="$emit('delete', task)" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
    
    <div class="task-meta-tags" v-if="projectName || contactName">
      <span v-if="projectName" class="meta-tag project-tag">📁 {{ projectName }}</span>
      <span v-if="contactName" class="meta-tag contact-tag">👤 {{ contactName }}</span>
    </div>

    <p v-if="task.descripcion" class="task-desc">{{ task.descripcion }}</p>
    
    <div class="task-footer">
      <span v-if="formattedDate" class="task-date">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        {{ formattedDate }}
      </span>
      <span v-if="task.area_contexto" class="task-badge">{{ task.area_contexto }}</span>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.3s ease;
}

.task-card:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

.task-card.is-done {
  opacity: 0.6;
}

.task-card.is-done .task-title {
  text-decoration: line-through;
  color: var(--text-muted);
}

.task-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.task-title {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 500;
  margin: 0;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.task-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.task-card:hover .task-actions {
  opacity: 1;
}

.icon-btn {
  background: transparent;
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  padding: 4px;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.edit-btn:hover { color: var(--accent-primary); }
.delete-btn:hover { color: var(--q1-color); }

.task-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: auto;
}

.task-date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.task-date svg {
  width: 14px;
  height: 14px;
}

.task-badge {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  color: var(--text-secondary);
}

.task-meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-tag {
  font-size: 0.7rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.project-tag {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.2);
  background: rgba(96, 165, 250, 0.05);
}

.contact-tag {
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.2);
  background: rgba(52, 211, 153, 0.05);
}

/* Custom Checkbox */
.custom-checkbox {
  display: block;
  position: relative;
  cursor: pointer;
  width: 18px;
  height: 18px;
  user-select: none;
  margin-top: 2px;
}

.custom-checkbox input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 18px;
  width: 18px;
  background-color: transparent;
  border: 2px solid var(--text-muted);
  border-radius: 4px;
  transition: all 0.2s;
}

.custom-checkbox:hover input ~ .checkmark {
  border-color: var(--accent-primary);
}

.custom-checkbox input:checked ~ .checkmark {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.custom-checkbox input:checked ~ .checkmark:after {
  display: block;
}

.custom-checkbox .checkmark:after {
  left: 5px;
  top: 1px;
  width: 4px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
</style>
