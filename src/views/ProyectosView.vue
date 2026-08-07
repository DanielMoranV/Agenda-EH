<script setup>
import { ref } from 'vue'
import { useProjects } from '../composables/useProjects'
import { useContacts } from '../composables/useContacts'

const { projects, addProject, updateProject, removeProject, loadingProjects } = useProjects()
const { contacts } = useContacts()

const isModalOpen = ref(false)
const isEditing = ref(false)
const currentProjectId = ref(null)

const defaultForm = { nombre: '', descripcion: '', estado: 'Activo', contacto_id: '' }
const formData = ref({ ...defaultForm })

const openModal = (project = null) => {
  if (project) {
    isEditing.value = true
    currentProjectId.value = project.id
    formData.value = { ...project }
  } else {
    isEditing.value = false
    currentProjectId.value = null
    formData.value = { ...defaultForm }
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const saveProject = async () => {
  if (!formData.value.nombre.trim()) {
    alert("El nombre del proyecto es obligatorio.")
    return
  }
  
  try {
    if (isEditing.value) {
      await updateProject(currentProjectId.value, formData.value)
    } else {
      await addProject(formData.value)
    }
    closeModal()
  } catch (err) {
    alert("Error al guardar el proyecto.")
  }
}

const deleteProject = async (id) => {
  if (confirm("¿Estás seguro de eliminar este proyecto?")) {
    try {
      await removeProject(id)
    } catch (err) {
      alert("Error al eliminar.")
    }
  }
}

const getContactName = (contactId) => {
  if (!contactId) return 'Sin responsable asignado'
  const contact = contacts.value.find(c => c.id === contactId)
  return contact ? contact.nombre : 'Contacto eliminado'
}
</script>

<template>
  <div class="proyectos-view">
    <div class="view-header">
      <h2>Mis Proyectos</h2>
      <button class="btn-primary" @click="openModal()">+ Nuevo Proyecto</button>
    </div>

    <div v-if="loadingProjects" class="loading-state">
      Cargando proyectos...
    </div>
    
    <div v-else-if="projects.length === 0" class="empty-state glass-panel">
      <p>No tienes proyectos activos aún.</p>
      <button class="btn-primary" @click="openModal()">Crear tu primer proyecto</button>
    </div>

    <div v-else class="projects-grid">
      <div v-for="project in projects" :key="project.id" class="project-card glass-panel">
        <div class="project-header">
          <h3>{{ project.nombre }}</h3>
          <span :class="['status-badge', project.estado.toLowerCase().replace(' ', '-')]">
            {{ project.estado }}
          </span>
        </div>
        
        <p class="project-desc">{{ project.descripcion || 'Sin descripción' }}</p>
        
        <div class="project-meta">
          <p class="responsable">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Responsable: <strong>{{ getContactName(project.contacto_id) }}</strong>
          </p>
        </div>

        <div class="project-actions">
          <button class="btn-icon" @click="openModal(project)" title="Editar">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon text-danger" @click="deleteProject(project.id)" title="Eliminar">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content glass-panel">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Editar Proyecto' : 'Nuevo Proyecto' }}</h3>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveProject" class="project-form">
          <div class="form-group">
            <label>Nombre del Proyecto *</label>
            <input type="text" v-model="formData.nombre" required placeholder="Ej. Lanzamiento Web V2">
          </div>
          
          <div class="form-group">
            <label>Descripción</label>
            <textarea v-model="formData.descripcion" rows="3" placeholder="Objetivos y contexto..."></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Responsable</label>
              <select v-model="formData.contacto_id">
                <option value="">-- Sin asignar (Propio) --</option>
                <option v-for="c in contacts" :key="c.id" :value="c.id">
                  {{ c.nombre }} ({{ c.email }})
                </option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Estado</label>
              <select v-model="formData.estado">
                <option value="Activo">Activo</option>
                <option value="En Pausa">En Pausa</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.proyectos-view {
  padding: 1.5rem;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.view-header h2 {
  color: var(--text-primary);
  margin: 0;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.project-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  position: relative;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.project-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.2rem;
  line-height: 1.3;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 12px;
  white-space: nowrap;
}
.status-badge.activo { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.status-badge.en-pausa { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.status-badge.finalizado { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }

.project-desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0 0 1.5rem 0;
  flex: 1;
}

.project-meta {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 1rem;
  margin-bottom: 1rem;
}

.responsable {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.responsable strong {
  color: var(--text-primary);
}

.project-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-icon:hover { background: rgba(255, 255, 255, 0.1); color: var(--text-primary); }
.text-danger:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

.btn-primary {
  background: var(--accent-primary);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}
.btn-primary:hover {
  background: var(--accent-primary-hover);
  transform: translateY(-1px);
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-color);
  background: var(--bg-surface);
}
.empty-state p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  animation: slideUp 0.2s ease-out;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}
.modal-header h3 { margin: 0; color: var(--text-primary); }

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
}
.close-btn:hover { color: var(--text-primary); }

.project-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-group label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-group input, .form-group textarea, .form-group select {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-family: inherit;
}

.form-group input:focus, .form-group textarea:focus, .form-group select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
}

.btn-cancel {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  cursor: pointer;
}
.btn-cancel:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .form-row { grid-template-columns: 1fr; }
}
</style>
