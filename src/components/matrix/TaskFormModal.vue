<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save'])

const defaultTask = {
  titulo: '',
  descripcion: '',
  es_urgente: false,
  es_importante: false,
  estado: 'Pendiente',
  area_contexto: '',
  fecha_inicio: '',
  fecha_vencimiento: ''
}

const formData = ref({ ...defaultTask })

// Reset form o llenarlo si viene una tarea para edición
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.task) {
      formData.value = { ...props.task }
    } else {
      formData.value = { ...defaultTask }
    }
  }
})

const handleSubmit = () => {
  if (!formData.value.titulo.trim()) return
  emit('save', { ...formData.value })
  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content glass-panel">
      <div class="modal-header">
        <h3>{{ task ? 'Editar Tarea' : 'Nueva Tarea' }}</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <form @submit.prevent="handleSubmit" class="task-form">
        <div class="form-group">
          <label for="titulo">Título *</label>
          <input 
            type="text" 
            id="titulo" 
            v-model="formData.titulo" 
            required 
            placeholder="Ej. Revisar informe mensual"
            autofocus
          >
        </div>

        <div class="form-group">
          <label for="descripcion">Descripción</label>
          <textarea 
            id="descripcion" 
            v-model="formData.descripcion" 
            rows="3" 
            placeholder="Detalles adicionales..."
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group toggle-group">
            <label class="toggle">
              <input type="checkbox" v-model="formData.es_importante">
              <span class="slider"></span>
            </label>
            <span>Es Importante</span>
          </div>
          
          <div class="form-group toggle-group">
            <label class="toggle">
              <input type="checkbox" v-model="formData.es_urgente">
              <span class="slider"></span>
            </label>
            <span>Es Urgente</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="fecha_inicio">Fecha de Inicio / Seguimiento</label>
            <input 
              type="date" 
              id="fecha_inicio" 
              v-model="formData.fecha_inicio" 
            >
          </div>
          <div class="form-group">
            <label for="fecha_vencimiento">Fecha de Vencimiento / Entrega</label>
            <input 
              type="date" 
              id="fecha_vencimiento" 
              v-model="formData.fecha_vencimiento" 
            >
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="area">Área / Contexto</label>
            <input 
              type="text" 
              id="area" 
              v-model="formData.area_contexto" 
              placeholder="Ej. Trabajo, Casa..."
            >
          </div>
          <div class="form-group">
            <label for="estado">Estado</label>
            <select id="estado" v-model="formData.estado">
              <option value="Pendiente">Pendiente</option>
              <option value="En curso">En curso</option>
              <option value="Finalizado">Finalizado</option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="$emit('close')">Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
  padding: 1rem;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  transition: color 0.2s;
}
.close-btn:hover { color: var(--text-primary); }

.task-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

input[type="text"],
input[type="date"],
textarea,
select {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input[type="text"]:focus,
input[type="date"]:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.toggle-group {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255,255,255,0.03);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.toggle-group span {
  font-size: 0.9rem;
  color: var(--text-primary);
}

/* Toggle Switch css */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}
.toggle input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255,255,255,0.1);
  transition: .3s;
  border-radius: 20px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 16px; width: 16px;
  left: 2px; bottom: 2px;
  background-color: var(--text-secondary);
  transition: .3s;
  border-radius: 50%;
}
input:checked + .slider { background-color: var(--accent-primary); }
input:checked + .slider:before {
  transform: translateX(20px);
  background-color: white;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn-cancel {
  background: transparent;
  color: var(--text-secondary);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 500;
}
.btn-cancel:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }

.btn-primary {
  background: var(--accent-primary);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background 0.2s, transform 0.1s;
}
.btn-primary:hover { background: var(--accent-primary-hover); transform: translateY(-1px); }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* Mobile Responsiveness */
@media (max-width: 600px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
  
  .modal-content {
    max-height: 85vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom: none;
    border-left: none;
    border-right: none;
    animation: slideUpBottomSheet 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  
  .form-row {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
  
  .form-actions {
    flex-direction: column-reverse;
  }
  
  .btn-cancel, .btn-primary {
    width: 100%;
    text-align: center;
  }
}

@keyframes slideUpBottomSheet { 
  from { opacity: 0; transform: translateY(100%); } 
  to { opacity: 1; transform: translateY(0); } 
}
</style>
