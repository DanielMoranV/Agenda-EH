<script setup>
import { computed } from 'vue'
import { useTheme } from '../../composables/useTheme'

const { preference, isDark, setTheme } = useTheme()

// Ciclo: Sistema → Claro → Oscuro → Sistema
const NEXT = { system: 'light', light: 'dark', dark: 'system' }

const LABELS = {
  system: 'Tema: según el sistema',
  light: 'Tema: claro',
  dark: 'Tema: oscuro'
}

const title = computed(() => `${LABELS[preference.value]} (pulsa para cambiar)`)

const cycle = () => setTheme(NEXT[preference.value])
</script>

<template>
  <button class="theme-toggle" :title="title" :aria-label="title" @click="cycle">
    <!-- Sol -->
    <svg v-if="preference === 'light'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
    <!-- Luna -->
    <svg v-else-if="preference === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
    <!-- Monitor (sigue al sistema) -->
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
    <span class="theme-label desktop-only">{{ preference === 'system' ? (isDark ? 'Auto' : 'Auto') : (preference === 'dark' ? 'Oscuro' : 'Claro') }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.7rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  transition: var(--transition);
}

.theme-toggle:hover {
  background: var(--hover-wash);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.theme-toggle svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .theme-label { display: none; }
  .theme-toggle { padding: 0.4rem 0.5rem; }
}
</style>
