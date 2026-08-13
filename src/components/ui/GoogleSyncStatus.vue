<script setup>
import { computed } from 'vue'
import { useGoogleToken } from '../../composables/useGoogleToken'

// Indicador permanente en la cabecera: el usuario ve de un vistazo si la
// sincronización con Google está activa, renovándose o caída.
const { status, hasValidToken, reconnectInteractive } = useGoogleToken()

const state = computed(() => {
  if (status.value === 'renewing') {
    return { key: 'renewing', label: 'Sincronizando…', title: 'Renovando la autorización de Google' }
  }
  if (status.value === 'connected' && hasValidToken.value) {
    return { key: 'ok', label: 'Google conectado', title: 'Calendar y Gmail sincronizados' }
  }
  return { key: 'off', label: 'Reconectar Google', title: 'La autorización de Google caducó. Pulsa para reconectar.' }
})

const onClick = () => {
  if (state.value.key === 'off') reconnectInteractive()
}
</script>

<template>
  <button
    class="sync-status"
    :class="`sync-status--${state.key}`"
    :title="state.title"
    :disabled="state.key !== 'off'"
    @click="onClick"
  >
    <span class="sync-dot"></span>
    <span class="sync-label">{{ state.label }}</span>
  </button>
</template>

<style scoped>
.sync-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  font-family: inherit;
  transition: var(--transition);
}

.sync-status:disabled { cursor: default; }

.sync-status--off {
  cursor: pointer;
  color: var(--q3-color);
  border-color: rgba(245, 158, 11, 0.45);
  background: var(--q3-bg);
}

.sync-status--off:hover { background: rgba(245, 158, 11, 0.15); }

.sync-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.sync-status--ok .sync-dot { background: #10b981; }
.sync-status--renewing .sync-dot {
  background: var(--accent-primary);
  animation: sync-pulse 1.1s ease-in-out infinite;
}

@keyframes sync-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@media (max-width: 768px) {
  .sync-label { display: none; }
  .sync-status { padding: 0.35rem 0.5rem; }
}
</style>
