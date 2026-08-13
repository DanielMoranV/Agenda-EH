<script setup>
import { useAuth } from '../composables/useAuth'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '../components/ui/ThemeToggle.vue'

const { loginWithGoogle, loading, error, sessionEndReason } = useAuth()
const route = useRoute()
const router = useRouter()

const handleLogin = async () => {
  const signedIn = await loginWithGoogle()
  if (signedIn) {
    // Volvemos a la vista donde estaba el usuario antes de que caducara la sesión
    router.replace(route.query.redirect || '/')
  }
}
</script>

<template>
  <div class="login-container">
    <!-- Aquí no hay cabecera todavía, así que el conmutador va suelto -->
    <div class="login-theme-toggle">
      <ThemeToggle />
    </div>

    <div class="login-card glass-panel">
      <div class="brand">
        <div class="logo-placeholder"></div>
        <h2>Agenda EH</h2>
        <p>Tu tiempo, priorizado de forma inteligente.</p>
      </div>

      <div class="auth-section">
        <!-- Explica POR QUÉ está aquí: antes la app le devolvía al login sin decir nada -->
        <p v-if="sessionEndReason && !error" class="notice-msg">{{ sessionEndReason }}</p>

        <button
          @click="handleLogin"
          :disabled="loading"
          class="google-btn"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" class="google-icon" />
          <span v-if="!loading">Continuar con Google</span>
          <span v-else>Autenticando...</span>
        </button>

        <p v-if="error" class="error-msg">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  padding: 1rem;
  /* Fondo animado sutil */
  background: radial-gradient(circle at center, var(--accent-soft-bg) 0%, transparent 60%);
}

.login-theme-toggle {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 3rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  text-align: center;
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.logo-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--accent-primary), var(--q2-color));
  margin-bottom: 1rem;
  box-shadow: var(--shadow-accent);
  animation: pulse 3s infinite alternate;
}

.brand h2 {
  font-size: 1.75rem;
  color: var(--text-primary);
}

.brand p {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.auth-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background-color: var(--google-btn-bg);
  color: var(--google-btn-text);
  border: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  transition: transform 0.2s, box-shadow 0.2s;
  width: 100%;
}

.google-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--border-strong);
}

.google-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.google-icon {
  width: 20px;
  height: 20px;
}

.error-msg {
  color: var(--q1-color);
  font-size: 0.85rem;
  background: var(--q1-bg);
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--danger-soft-border);
}

.notice-msg {
  color: var(--q3-color);
  font-size: 0.85rem;
  line-height: 1.45;
  background: var(--q3-bg);
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--warning-soft-border);
}

/* Animations */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0% { box-shadow: 0 0 12px var(--accent-soft-border); }
  100% { box-shadow: var(--shadow-accent); }
}
</style>
