<script setup>
import { useNotifications } from '../../composables/useNotifications'

const { notifications, dismiss } = useNotifications()

const ICONS = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  warning: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  info: 'M12 16v-4m0-4h.01M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z'
}

const runAction = async (toast) => {
  const handler = toast.action?.handler
  dismiss(toast.id)
  if (handler) await handler()
}
</script>

<template>
  <div class="toast-host" role="region" aria-live="polite" aria-label="Notificaciones">
    <transition-group name="toast">
      <div
        v-for="toast in notifications"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.type}`"
        role="alert"
      >
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path :d="ICONS[toast.type] || ICONS.info" />
        </svg>

        <div class="toast-body">
          <p class="toast-title">{{ toast.title }}</p>
          <p v-if="toast.message" class="toast-message">{{ toast.message }}</p>
          <button v-if="toast.action" class="toast-action" @click="runAction(toast)">
            {{ toast.action.label }}
          </button>
        </div>

        <button class="toast-close" aria-label="Cerrar notificación" @click="dismiss(toast.id)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
/* Abajo a la derecha: la cabecera es sticky, así que arriba taparía los
   botones de sesión y de "Nueva Tarea". */
.toast-host {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  z-index: 3000;
  display: flex;
  flex-direction: column-reverse; /* la más reciente, más cerca del borde */
  gap: 0.6rem;
  width: min(380px, calc(100vw - 2.5rem));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--toast-accent, var(--accent-primary));
  border-radius: var(--radius-md);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}

.toast--success { --toast-accent: #10b981; }
.toast--error   { --toast-accent: var(--q1-color); }
.toast--warning { --toast-accent: var(--q3-color); }
.toast--info    { --toast-accent: var(--accent-primary); }

.toast-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--toast-accent);
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.35;
}

.toast-message {
  margin-top: 0.2rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.45;
  word-break: break-word;
}

.toast-action {
  margin-top: 0.6rem;
  background: var(--toast-accent);
  color: #fff;
  border: none;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.35rem 0.8rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.toast-action:hover { filter: brightness(1.12); }

.toast-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  line-height: 0;
  flex-shrink: 0;
}

.toast-close:hover { color: var(--text-primary); }

/* Animaciones */
.toast-enter-active,
.toast-leave-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-enter-from   { opacity: 0; transform: translateX(20px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }
.toast-move         { transition: transform 0.25s ease; }

@media (max-width: 768px) {
  .toast-host {
    bottom: 5.5rem; /* por encima del FAB de "Nueva Tarea" */
    left: 0.6rem;
    right: 0.6rem;
    width: auto;
  }
  .toast-enter-from, .toast-leave-to { transform: translateY(16px); }
}
</style>
