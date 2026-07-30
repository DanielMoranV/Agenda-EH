<script setup>
// Vista principal del Dashboard que contendrá la matriz
</script>

<template>
  <div class="dashboard-view">
    <header class="dashboard-header">
      <h2>Matriz de Eisenhower</h2>
      <p class="subtitle">Clasifica y domina tu tiempo de forma dinámica.</p>
    </header>
    
    <div class="matrix-container glass-panel">
      <!-- Aquí irán los 4 cuadrantes en el siguiente paso -->
      <div class="matrix-grid">
        <div class="quadrant q1">
          <h3>Hacer (I)</h3>
          <p>Urgente e Importante</p>
        </div>
        <div class="quadrant q2">
          <h3>Decidir (II)</h3>
          <p>Importante, No Urgente</p>
        </div>
        <div class="quadrant q3">
          <h3>Delegar (III)</h3>
          <p>Urgente, No Importante</p>
        </div>
        <div class="quadrant q4">
          <h3>Eliminar (IV)</h3>
          <p>Ni Urgente Ni Importante</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
}

.dashboard-header {
  padding: 0 1rem;
}

.dashboard-header h2 {
  font-size: 2rem;
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-top: 0.25rem;
}

.matrix-container {
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  min-height: 600px;
}

.matrix-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 1rem;
  height: 100%;
  flex: 1;
}

.quadrant {
  border-radius: var(--radius-md);
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  transition: var(--transition);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quadrant:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.quadrant h3 {
  font-size: 1.25rem;
}

.quadrant p {
  font-size: 0.85rem;
  opacity: 0.8;
}

/* Quadrant Styles */
.q1 {
  background: var(--q1-bg);
  border-left: 4px solid var(--q1-color);
}
.q1 h3 { color: var(--q1-color); }

.q2 {
  background: var(--q2-bg);
  border-left: 4px solid var(--q2-color);
}
.q2 h3 { color: var(--q2-color); }

.q3 {
  background: var(--q3-bg);
  border-left: 4px solid var(--q3-color);
}
.q3 h3 { color: var(--q3-color); }

.q4 {
  background: var(--q4-bg);
  border-left: 4px solid var(--q4-color);
}
.q4 h3 { color: var(--q4-color); }

/* Responsive adjustments (RNF-04) */
@media (max-width: 768px) {
  .matrix-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
  
  .matrix-container {
    padding: 1rem;
  }
}
</style>
