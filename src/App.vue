<script setup>
// Componente raíz
</script>

<template>
  <div class="app-layout">
    <header class="app-header glass-panel">
      <h1>Agenda EH</h1>
      <div class="header-actions">
        <!-- Auth state and actions will go here -->
        <div class="avatar-placeholder"></div>
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

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary), var(--q2-color));
  box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
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
