<script setup>
import { useAuth } from './composables/useAuth'
import { useFilters } from './composables/useFilters'
import { useRoute } from 'vue-router'

const { user, logout } = useAuth()
const { filterStatus, filterDateType, filterDateRange, triggerNewTask } = useFilters()
const route = useRoute()
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
            <router-link to="/proyectos" class="nav-link">Proyectos</router-link>
            <router-link to="/contactos" class="nav-link">Contactos</router-link>
          </nav>
        </div>
        
        <div class="header-actions">
          <div class="user-menu">
            <img v-if="user.photoURL" :src="user.photoURL" alt="Avatar" class="user-avatar" />
            <div v-else class="avatar-placeholder"></div>
            <button @click="logout" class="logout-btn" title="Cerrar Sesión">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span class="desktop-only">Salir</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Bottom Row: Filters (Only visible in Dashboard view) -->
      <div class="header-bottom" v-if="route.name === 'dashboard'">
        <div class="filters-bar">
          <div class="filters-scroll">
            <div class="filter-group">
              <label>Estado:</label>
              <select v-model="filterStatus" class="corp-select">
                <option value="Todos">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En curso">En curso</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </div>
            
            <div class="filter-divider desktop-only"></div>
            
            <div class="filter-group">
              <label>Periodo:</label>
              <select v-model="filterDateType" class="corp-select">
                <option value="todos">Cualquier fecha</option>
                <option value="hoy">Hoy</option>
                <option value="esta-semana">Esta semana</option>
                <option value="este-mes">Este mes</option>
                <option value="rango">Rango</option>
              </select>
            </div>
            
            <div v-if="filterDateType === 'rango'" class="filter-group range-group">
              <input type="date" v-model="filterDateRange.start" class="corp-input" />
              <span>-</span>
              <input type="date" v-model="filterDateRange.end" class="corp-input" />
            </div>
          </div>
          
          <div class="filter-actions">
            <button class="btn-create" @click="triggerNewTask = true" title="Nueva Tarea">
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
  background: rgba(0, 0, 0, 0.15);
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
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
  background: rgba(255, 255, 255, 0.05);
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
  align-items: center;
  justify-content: space-between;
}

.filters-scroll {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  overflow-x: auto;
}
.filters-scroll::-webkit-scrollbar { display: none; }

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
}

.corp-select:focus, .corp-input:focus {
  border-color: var(--accent-primary);
}

.filter-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
}

.range-group span {
  color: var(--text-secondary);
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
  .header-top {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  .brand-nav {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    width: 100%;
  }
  .view-nav {
    width: 100%;
    display: flex;
  }
  .nav-link {
    flex: 1;
    text-align: center;
  }
  .user-menu {
    width: 100%;
    justify-content: flex-end;
  }
  .filters-bar {
    padding-bottom: 0.25rem;
  }
  
  .filters-scroll {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  
  .desktop-only { display: none; }
  
  .btn-create {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    padding: 0;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    z-index: 1000;
  }
  
  .btn-create svg {
    width: 24px;
    height: 24px;
  }
}
</style>
