<script setup>
import { useAuth } from './composables/useAuth'

const { user, logout } = useAuth()
</script>

<template>
  <div class="app-layout">
    <header class="app-header glass-panel">
      <h1>Agenda EH</h1>
      <div class="header-actions">
        <div v-if="user" class="user-menu">
          <img v-if="user.photoURL" :src="user.photoURL" alt="Avatar" class="user-avatar" />
          <div v-else class="avatar-placeholder"></div>
          <button @click="logout" class="logout-btn">Salir</button>
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

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-radius: var(--radius-lg);
  position: sticky;
  top: 1rem;
  z-index: 100;
}

.app-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--accent-primary);
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary), var(--q2-color));
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
}

.logout-btn {
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  transition: var(--transition);
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Page Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
