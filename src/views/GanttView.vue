<script setup>
import { computed, ref } from 'vue'
import { useTasks } from '../composables/useTasks'
import { useProjects } from '../composables/useProjects'
import { useFilters, parseDateTime } from '../composables/useFilters'

const { tasks } = useTasks()
const { projects } = useProjects()
const { filterDateType, filterDateRange, filterSingleDate, matchesFilters } = useFilters()

// --- Constantes de tiempo y layout ---
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_COL_WIDTH = 90   // px por cada día en modo "Días"
const HOUR_COL_WIDTH = 70  // px por cada hora en modo "24 Horas"

// Modo de vista: 'auto' sigue al filtro; el usuario puede forzar 'days' u 'hours'
const userViewMode = ref('auto')

const viewMode = computed(() => {
  if (userViewMode.value !== 'auto') return userViewMode.value
  // Auto: si el filtro es de un solo día, mostramos las 24 horas
  if (filterDateType.value === 'hoy') return 'hours'
  if (filterDateType.value === 'dia' && filterSingleDate.value) return 'hours'
  if (
    filterDateType.value === 'rango' &&
    filterDateRange.value.start &&
    filterDateRange.value.start === filterDateRange.value.end
  ) return 'hours'
  return 'days'
})

// Medianoche (00:00) del día de la fecha dada
const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

// Filtramos tareas que tengan al menos una fecha y calculamos su rango real
const ganttTasks = computed(() => {
  // Filtrado compartido con la vista Matriz (ver useFilters.matchesFilters)
  return tasks.value.filter(matchesFilters)
    .filter(t => t.fecha_inicio || t.fecha_vencimiento)
    .map(t => {
      const startStr = t.fecha_inicio || t.fecha_vencimiento
      const endStr = t.fecha_vencimiento || t.fecha_inicio

      const hasTime = !!t.con_hora
      const startTime = hasTime && t.hora_inicio ? t.hora_inicio : '00:00'

      const startDate = parseDateTime(startStr, startTime)

      let endDate
      if (hasTime && t.hora_vencimiento) {
        // Fin con hora explícita
        endDate = parseDateTime(endStr, t.hora_vencimiento)
      } else if (hasTime && t.hora_inicio && startStr === endStr) {
        // Un solo día con inicio pero sin fin: 1 hora de duración por defecto
        endDate = new Date(startDate.getTime() + HOUR_MS)
      } else {
        // Sin hora de fin: ocupa hasta el final del día de vencimiento
        endDate = parseDateTime(endStr, '00:00')
        endDate.setHours(23, 59, 59, 999)
      }

      // Corrección si el fin quedó antes o igual que el inicio (error de captura)
      if (endDate <= startDate) {
        endDate = new Date(startDate.getTime() + (hasTime ? HOUR_MS : DAY_MS))
      }

      const project = projects.value.find(p => p.id === t.proyecto_id)

      // Cuadrante Eisenhower
      let quadrantName = ''
      let quadrantClass = ''
      if (t.es_urgente && t.es_importante) {
        quadrantName = 'I - Hacer (Urgente e Importante)'
        quadrantClass = 'q1-tag'
      } else if (!t.es_urgente && t.es_importante) {
        quadrantName = 'II - Decidir (Importante, No Urgente)'
        quadrantClass = 'q2-tag'
      } else if (t.es_urgente && !t.es_importante) {
        quadrantName = 'III - Delegar (Urgente, No Importante)'
        quadrantClass = 'q3-tag'
      } else {
        quadrantName = 'IV - Eliminar (Ni Urgente Ni Importante)'
        quadrantClass = 'q4-tag'
      }

      return {
        ...t,
        startDate,
        endDate,
        projectName: project ? project.nombre : 'Sin Proyecto',
        quadrantName,
        quadrantClass,
        durationDays: Math.max(1, Math.ceil((endDate - startDate) / DAY_MS))
      }
    })
    // Orden estable: por inicio y, a igualdad, por fin
    .sort((a, b) => (a.startDate - b.startDate) || (a.endDate - b.endDate))
})

// Rango y métricas del calendario. Todo se ancla a medianoche y se mide en píxeles
// para que cabecera, líneas de grilla y barras compartan exactamente el mismo eje.
const calendarRange = computed(() => {
  if (viewMode.value === 'hours') {
    // --- Modo 24 Horas: un día completo, 24 columnas de 1 hora ---
    let baseDate = new Date()
    if (filterDateType.value === 'dia' && filterSingleDate.value) {
      baseDate = parseDateTime(filterSingleDate.value, '00:00')
    } else if (filterDateType.value === 'rango' && filterDateRange.value.start) {
      baseDate = parseDateTime(filterDateRange.value.start, '00:00')
    } else if (ganttTasks.value.length > 0 && filterDateType.value !== 'hoy') {
      // Si el usuario forzó "horas" sin ser hoy, centramos en la primera tarea
      baseDate = ganttTasks.value[0].startDate
    }

    const minDate = startOfDay(baseDate)
    const maxDate = new Date(minDate.getTime() + DAY_MS) // fin exclusivo (medianoche siguiente)

    const units = []
    for (let i = 0; i < 24; i++) {
      units.push({
        label: `${i.toString().padStart(2, '0')}:00`,
        isWeekend: false
      })
    }

    const colWidth = HOUR_COL_WIDTH
    return { minDate, maxDate, units, colWidth, chartWidth: units.length * colWidth }
  }

  // --- Modo Días: N columnas de 1 día exacto ---
  if (ganttTasks.value.length === 0) {
    const today = startOfDay(new Date())
    const maxDate = new Date(today.getTime() + DAY_MS)
    const units = [{
      label: today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      isWeekend: today.getDay() === 0 || today.getDay() === 6
    }]
    return { minDate: today, maxDate, units, colWidth: DAY_COL_WIDTH, chartWidth: DAY_COL_WIDTH }
  }

  const firstStart = new Date(Math.min(...ganttTasks.value.map(t => t.startDate.getTime())))
  const lastEnd = new Date(Math.max(...ganttTasks.value.map(t => t.endDate.getTime())))

  // Medianoche del primer día - 1 día de margen
  const minDate = startOfDay(firstStart)
  minDate.setDate(minDate.getDate() - 1)

  // Fin exclusivo: medianoche siguiente al último día + 1 día de margen
  const maxDate = startOfDay(lastEnd)
  maxDate.setDate(maxDate.getDate() + 2)

  const units = []
  const cursor = new Date(minDate)
  while (cursor < maxDate) {
    units.push({
      label: cursor.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const colWidth = DAY_COL_WIDTH
  return { minDate, maxDate, units, colWidth, chartWidth: units.length * colWidth }
})

// Posición de cada barra en píxeles, sobre el MISMO eje que la grilla.
const getTaskGridStyle = (task) => {
  const { minDate, maxDate, colWidth } = calendarRange.value
  const unitMs = viewMode.value === 'hours' ? HOUR_MS : DAY_MS
  const pxPerMs = colWidth / unitMs

  // Recorte al rango visible
  const taskStart = Math.max(task.startDate.getTime(), minDate.getTime())
  const taskEnd = Math.min(task.endDate.getTime(), maxDate.getTime())

  // Fuera del rango visible (p. ej. tareas de otro día en modo 24 horas)
  if (taskEnd <= minDate.getTime() || taskStart >= maxDate.getTime()) {
    return { display: 'none' }
  }

  const leftPx = (taskStart - minDate.getTime()) * pxPerMs
  let widthPx = (taskEnd - taskStart) * pxPerMs
  if (widthPx < 6) widthPx = 6 // ancho mínimo visible

  return {
    left: `${leftPx}px`,
    width: `${widthPx}px`,
    backgroundColor: getStatusColor(task.estado)
  }
}

const getStatusColor = (estado) => {
  if (estado === 'En curso') return '#f59e0b' // Ámbar
  if (estado === 'Finalizado') return '#10b981' // Verde
  return '#ef4444' // Rojo (Pendiente)
}
</script>

<template>
  <div class="gantt-view">
    <div class="glass-panel gantt-container">
      <div class="gantt-header">
        <div class="gantt-header-text">
          <h2>Diagrama de Gantt</h2>
          <p>Visualización cronológica de tus tareas programadas</p>
        </div>
        <div class="view-toggle">
          <button
            :class="{ active: userViewMode === 'auto' }"
            @click="userViewMode = 'auto'"
          >Automático</button>
          <button
            :class="{ active: viewMode === 'days' && userViewMode !== 'auto' }"
            @click="userViewMode = 'days'"
          >Días</button>
          <button
            :class="{ active: viewMode === 'hours' && userViewMode !== 'auto' }"
            @click="userViewMode = 'hours'"
          >24 Horas</button>
        </div>
      </div>

      <div v-if="ganttTasks.length === 0" class="empty-state">
        <p>No hay tareas con fechas asignadas para mostrar en el diagrama.</p>
      </div>

      <div v-else class="gantt-wrapper">
        <!-- Panel lateral con nombres de tareas -->
        <div class="gantt-sidebar">
          <div class="sidebar-header">Tarea / Proyecto</div>
          <div class="sidebar-row" v-for="task in ganttTasks" :key="'side-'+task.id">
            <div class="task-info">
              <div class="task-title-wrap">
                <span class="quadrant-dot" :class="task.quadrantClass" :title="task.quadrantName"></span>
                <span class="task-title" :title="task.titulo">{{ task.titulo }}</span>
              </div>
              <span class="task-project">{{ task.projectName }}</span>
            </div>
          </div>
        </div>

        <!-- Área del gráfico -->
        <div class="gantt-chart">
          <!-- Eje de fechas/horas -->
          <div
            class="chart-timeline"
            :style="{ gridTemplateColumns: `repeat(${calendarRange.units.length}, ${calendarRange.colWidth}px)`, width: `${calendarRange.chartWidth}px` }"
          >
            <div
              v-for="(unit, index) in calendarRange.units"
              :key="'header-'+index"
              class="timeline-day"
              :class="{ 'is-weekend': unit.isWeekend }"
            >
              {{ unit.label }}
            </div>
          </div>

          <!-- Filas de tareas -->
          <div class="chart-rows" :style="{ width: `${calendarRange.chartWidth}px` }">
            <!-- Líneas verticales de fondo -->
            <div
              class="grid-lines"
              :style="{ gridTemplateColumns: `repeat(${calendarRange.units.length}, ${calendarRange.colWidth}px)`, width: `${calendarRange.chartWidth}px` }"
            >
              <div
                v-for="(unit, index) in calendarRange.units"
                :key="'bg-'+index"
                class="grid-line"
                :class="{ 'is-weekend': unit.isWeekend }"
              ></div>
            </div>

            <!-- Barras (posicionamiento absoluto) -->
            <div class="task-bars" :style="{ width: `${calendarRange.chartWidth}px` }">
              <div 
                class="task-row-wrapper"
                v-for="task in ganttTasks" 
                :key="'bar-'+task.id"
              >
                <div 
                  class="task-bar" 
                  :style="getTaskGridStyle(task)"
                  :title="`${task.titulo} (${task.estado}) - ${task.startDate.toLocaleTimeString()} a ${task.endDate.toLocaleTimeString()}`"
                >
                  <span class="bar-label">{{ task.titulo }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="legends-container">
        <div class="gantt-legend">
          <span class="legend-title">Estado:</span>
          <span class="legend-item"><span class="color-dot pending"></span> Pendiente</span>
          <span class="legend-item"><span class="color-dot in-progress"></span> En Curso</span>
          <span class="legend-item"><span class="color-dot done"></span> Finalizado</span>
        </div>
        <div class="gantt-legend">
          <span class="legend-title">Matriz:</span>
          <span class="legend-item"><span class="color-dot q1-tag"></span> Hacer</span>
          <span class="legend-item"><span class="color-dot q2-tag"></span> Decidir</span>
          <span class="legend-item"><span class="color-dot q3-tag"></span> Delegar</span>
          <span class="legend-item"><span class="color-dot q4-tag"></span> Eliminar</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gantt-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.gantt-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: hidden;
}

.gantt-header {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.gantt-header h2 {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.gantt-header p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

/* Toggle de vista Días / 24 Horas */
.view-toggle {
  display: flex;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.25rem;
  flex-shrink: 0;
}

.view-toggle button {
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-sm);
  transition: background 0.2s, color 0.2s;
}

.view-toggle button:hover {
  color: var(--text-primary);
}

.view-toggle button.active {
  background: var(--accent-primary);
  color: white;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.gantt-wrapper {
  display: flex;
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
}

/* Sidebar */
.gantt-sidebar {
  width: 250px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  text-transform: uppercase;
}

.sidebar-row {
  height: 50px;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow: hidden;
  width: 100%;
}

.task-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
}

.quadrant-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.q1-tag { background: var(--q1-color); }
.q2-tag { background: var(--q2-color); }
.q3-tag { background: var(--q3-color); }
.q4-tag { background: var(--q4-color); }

.task-title {
  font-size: 0.9rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-project {
  font-size: 0.7rem;
  color: #60a5fa;
}

/* Gráfico */
.gantt-chart {
  flex: 1;
  overflow-x: auto;
  display: flex;
  flex-direction: column;
  position: relative;
}

.chart-timeline {
  display: grid;
  border-bottom: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.4);
}

.timeline-day {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
  white-space: nowrap;
}

.timeline-day.is-weekend {
  color: var(--q4-color);
  background: rgba(255, 255, 255, 0.02);
}

.chart-rows {
  position: relative;
  flex: 1;
  overflow-y: auto;
}

.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  display: grid;
  pointer-events: none;
}

.grid-line {
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.grid-line.is-weekend {
  background: rgba(255, 255, 255, 0.015);
}

.task-bars {
  position: relative;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.task-row-wrapper {
  height: 50px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid transparent;
  padding: 0;
  position: relative;
}

.task-bar {
  position: absolute;
  height: 30px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  transition: transform 0.2s;
  cursor: pointer;
  overflow: hidden;
}

.task-bar:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.bar-label {
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* Leyenda */
.legends-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
}

.gantt-legend {
  display: flex;
  gap: 1.25rem;
  align-items: center;
}

.legend-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-right: 0.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.color-dot.pending { background: #ef4444; }
.color-dot.in-progress { background: #f59e0b; }
.color-dot.done { background: #10b981; }

/* Responsive */
@media (max-width: 768px) {
  .gantt-container {
    padding: 1rem;
  }

  .gantt-header {
    flex-direction: column;
    align-items: stretch;
  }

  .gantt-header h2 {
    font-size: 1.25rem;
  }

  /* Toggle de vista a todo el ancho, botones equitativos */
  .view-toggle {
    width: 100%;
  }
  .view-toggle button {
    flex: 1;
    text-align: center;
  }

  /* Sidebar más angosto para dejar espacio al gráfico (que ya scrollea) */
  .gantt-sidebar {
    width: 140px;
  }

  .sidebar-header {
    padding: 0 0.6rem;
    font-size: 0.7rem;
  }

  .sidebar-row {
    padding: 0 0.6rem;
  }

  .task-title {
    font-size: 0.8rem;
  }

  .task-project {
    font-size: 0.65rem;
  }

  /* Leyendas apiladas y compactas */
  .legends-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .gantt-legend {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}

@media (max-width: 480px) {
  .gantt-sidebar {
    width: 110px;
  }
  .gantt-legend {
    gap: 0.5rem 0.75rem;
  }
  .legend-item {
    font-size: 0.75rem;
  }
}
</style>
