<script setup>
import { ref } from 'vue'
import { useContacts } from '../composables/useContacts'

const { contacts, addContact, updateContact, removeContact, loadingContacts } = useContacts()

const isModalOpen = ref(false)
const isEditing = ref(false)
const currentContactId = ref(null)

const defaultForm = { nombre: '', email: '', telefono: '' }
const formData = ref({ ...defaultForm })

const openModal = (contact = null) => {
  if (contact) {
    isEditing.value = true
    currentContactId.value = contact.id
    formData.value = { ...contact }
  } else {
    isEditing.value = false
    currentContactId.value = null
    formData.value = { ...defaultForm }
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const saveContact = async () => {
  if (!formData.value.nombre.trim() || !formData.value.email.trim()) {
    alert("El nombre y el correo son obligatorios.")
    return
  }
  
  try {
    if (isEditing.value) {
      await updateContact(currentContactId.value, formData.value)
    } else {
      await addContact(formData.value)
    }
    closeModal()
  } catch (err) {
    alert("Error al guardar el contacto.")
  }
}

const deleteContact = async (id) => {
  if (confirm("¿Estás seguro de eliminar este contacto?")) {
    try {
      await removeContact(id)
    } catch (err) {
      alert("Error al eliminar.")
    }
  }
}
</script>

<template>
  <div class="contactos-view">
    <div class="view-header">
      <h2>Mis Contactos / Responsables</h2>
      <button class="btn-primary" @click="openModal()">+ Nuevo Contacto</button>
    </div>

    <div v-if="loadingContacts" class="loading-state">
      Cargando contactos...
    </div>
    
    <div v-else-if="contacts.length === 0" class="empty-state glass-panel">
      <p>No tienes contactos guardados aún.</p>
      <button class="btn-primary" @click="openModal()">Crear tu primer contacto</button>
    </div>

    <div v-else class="contacts-grid">
      <div v-for="contact in contacts" :key="contact.id" class="contact-card glass-panel">
        <div class="contact-info">
          <h3>{{ contact.nombre }}</h3>
          <p class="email">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            {{ contact.email }}
          </p>
          <p class="phone" v-if="contact.telefono">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            {{ contact.telefono }}
          </p>
        </div>
        <div class="contact-actions">
          <button class="btn-icon" @click="openModal(contact)" title="Editar">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon text-danger" @click="deleteContact(contact.id)" title="Eliminar">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content glass-panel">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Editar Contacto' : 'Nuevo Contacto' }}</h3>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveContact" class="contact-form">
          <div class="form-group">
            <label>Nombre Completo *</label>
            <input type="text" v-model="formData.nombre" required placeholder="Ej. Juan Pérez">
          </div>
          
          <div class="form-group">
            <label>Correo Electrónico *</label>
            <input type="email" v-model="formData.email" required placeholder="juan@ejemplo.com">
          </div>
          
          <div class="form-group">
            <label>Teléfono (Opcional)</label>
            <input type="text" v-model="formData.telefono" placeholder="+34 600 000 000">
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
.contactos-view {
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

.contacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 1.5rem;
}

.contact-card {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.contact-info h3 {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
}

.contact-info p {
  margin: 0.4rem 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.contact-actions {
  display: flex;
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

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.text-danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  width: 100%;
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
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

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
}
.close-btn:hover {
  color: var(--text-primary);
}

.contact-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

.form-group input {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  font-family: inherit;
}

.form-group input:focus {
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

.btn-cancel:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-primary);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mobile responsiveness */
@media (max-width: 600px) {
  .contactos-view { padding: 1rem; }
  .view-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .view-header .btn-primary { width: 100%; }
  .contacts-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .modal-overlay { align-items: flex-end; padding: 0; }
  .modal-content {
    max-width: 100%;
    max-height: 92vh;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    border-bottom: none;
  }
}
</style>
