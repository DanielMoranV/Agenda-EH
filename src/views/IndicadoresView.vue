<script setup>
import { ref, computed } from 'vue'
import { useTasks } from '../composables/useTasks'
import { useProjects } from '../composables/useProjects'
import { useContacts } from '../composables/useContacts'
import { useFilters } from '../composables/useFilters'

const { tasks, loadingTasks } = useTasks()
const { projects } = useProjects()
const { contacts } = useContacts()
// Solo proyecto y responsable: el filtro de estado vaciaría el indicador (mide
// los tres estados) y el de periodo lo sustituye el selector de mes.
const { filterProject, filterContact } = useFilters()

// Orden de lectura del desglose: de lo cumplido a lo pendiente
const STATUSES = [
  { key: 'Finalizado', label: 'Finalizadas', dot: 'done' },
  { key: 'En curso', label: 'En curso', dot: 'in-progress' },
  { key: 'Pendiente', label: 'Pendientes', dot: 'pending' }
]

// --- Mes en foco ("YYYY-MM") ---
const toMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const selectedMonth = ref(toMonthKey(new Date()))

const monthLabel = computed(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  return new Date(year, month - 1, 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
})

const shiftMonth = (delta) => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  selectedMonth.value = toMonthKey(new Date(year, month - 1 + delta, 1))
}

// --- Tareas del mes ---
// Una tarea cuenta en el mes de su fecha de vencimiento. Si no tiene, cuenta en
// el de su fecha de inicio. Sin ninguna de las dos no es medible y queda fuera.
// Comparamos los strings "YYYY-MM-DD" recortados, no objetos Date: así el mes
// es el que el usuario escribió, sin que la zona horaria lo desplace un día.
const monthTasks = computed(() => {
  return tasks.value
    .filter(task => {
      if (filterProject.value !== 'Todos' && task.proyecto_id !== filterProject.value) return false
      if (filterContact.value !== 'Todos' && task.contacto_id !== filterContact.value) return false

      const reference = task.fecha_vencimiento || task.fecha_inicio
      return Boolean(reference) && reference.slice(0, 7) === selectedMonth.value
    })
    .map(task => {
      const project = projects.value.find(p => p.id === task.proyecto_id)
      const contact = contacts.value.find(c => c.id === task.contacto_id)

      return {
        ...task,
        projectName: project ? project.nombre : 'Sin Proyecto',
        contactName: contact ? contact.nombre : '—',
        referenceDate: task.fecha_vencimiento || task.fecha_inicio,
        isDueDate: Boolean(task.fecha_vencimiento)
      }
    })
})

// Un estado desconocido cuenta como pendiente: las partes tienen que sumar
// siempre el total, o el indicador miente.
const summarize = (list) => {
  const counts = { 'Finalizado': 0, 'En curso': 0, 'Pendiente': 0 }
  list.forEach(task => {
    counts[counts[task.estado] === undefined ? 'Pendiente' : task.estado] += 1
  })

  return {
    total: list.length,
    counts,
    ratio: list.length ? counts['Finalizado'] / list.length : 0
  }
}

const monthSummary = computed(() => summarize(monthTasks.value))

// --- Agrupación y orden por proyecto ---
const projectGroups = computed(() => {
  const groups = new Map()

  monthTasks.value.forEach(task => {
    const key = task.proyecto_id || ''
    if (!groups.has(key)) {
      groups.set(key, { id: key, name: task.projectName, tasks: [] })
    }
    groups.get(key).tasks.push(task)
  })

  return [...groups.values()]
    .map(group => ({
      ...group,
      ...summarize(group.tasks),
      // Dentro del proyecto, por la fecha que se está midiendo
      tasks: [...group.tasks].sort((a, b) =>
        a.referenceDate.localeCompare(b.referenceDate) ||
        a.titulo.localeCompare(b.titulo, 'es')
      )
    }))
    .sort((a, b) => {
      if (!a.id) return 1  // "Sin Proyecto" cierra el informe
      if (!b.id) return -1
      return a.name.localeCompare(b.name, 'es')
    })
})

// --- Formato ---
const formatPercent = (ratio) => `${Math.round(ratio * 100)}%`

const formatDate = (isoDate) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
    .toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// El relleno del medidor lleva la severidad; el porcentaje siempre va escrito
// al lado, así que el color nunca es el único canal.
const severityOf = (ratio) => {
  if (ratio >= 0.8) return 'good'
  if (ratio >= 0.5) return 'warning'
  return 'critical'
}

const meterLabel = (group) =>
  `${group.name}: ${group.counts['Finalizado']} finalizadas, ` +
  `${group.counts['En curso']} en curso y ${group.counts['Pendiente']} pendientes ` +
  `de ${group.total}`
</script>

<template>
  <div class="indicadores-view">
    <div class="glass-panel indicadores-container">
      <div class="view-header">
        <div class="view-header-text">
          <h2>Indicadores de cumplimiento</h2>
          <p>
            Cada tarea se mide en el mes de su fecha de vencimiento; si no tiene,
            en el de su fecha de inicio.
          </p>
        </div>

        <div class="month-picker">
          <button
            class="month-nav"
            title="Mes anterior"
            aria-label="Mes anterior"
            @click="shiftMonth(-1)"
          >‹</button>
          <label class="month-field">
            <span class="month-label">{{ monthLabel }}</span>
            <input type="month" v-model="selectedMonth" aria-label="Mes a consultar" />
          </label>
          <button
            class="month-nav"
            title="Mes siguiente"
            aria-label="Mes siguiente"
            @click="shiftMonth(1)"
          >›</button>
        </div>
      </div>

      <p v-if="loadingTasks" class="state-message">Cargando tareas…</p>

      <template v-else-if="monthSummary.total > 0">
        <!-- Cifra principal del mes + desglose -->
        <section class="summary">
          <div class="hero">
            <span class="hero-label">Cumplimiento de {{ monthLabel }}</span>
            <strong class="hero-value">{{ formatPercent(monthSummary.ratio) }}</strong>
            <span class="hero-note">
              {{ monthSummary.counts['Finalizado'] }} de {{ monthSummary.total }}
              tareas finalizadas
            </span>
          </div>

          <div class="stat-tiles">
            <div class="stat-tile">
              <span class="stat-label">Tareas del mes</span>
              <span class="stat-value">{{ monthSummary.total }}</span>
            </div>
            <div class="stat-tile" v-for="status in STATUSES" :key="status.key">
              <span class="stat-label">
                <span class="color-dot" :class="status.dot"></span>
                {{ status.label }}
              </span>
              <span class="stat-value">{{ monthSummary.counts[status.key] }}</span>
            </div>
          </div>
        </section>

        <!-- Un bloque por proyecto -->
        <section class="projects">
          <article
            class="project-card"
            v-for="group in projectGroups"
            :key="group.id || 'sin-proyecto'"
          >
            <div class="project-header">
              <h3 class="project-name">{{ group.name }}</h3>
              <span class="project-ratio">
                {{ formatPercent(group.ratio) }}
                <span class="project-ratio-note">de cumplimiento</span>
              </span>
            </div>

            <!-- El área sensible es el envoltorio, no la barra de 10px: así el
                 objetivo de hover/foco supera el mínimo de ~24px -->
            <div
              class="meter-wrap"
              role="progressbar"
              tabindex="0"
              :aria-valuenow="Math.round(group.ratio * 100)"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="meterLabel(group)"
              :title="meterLabel(group)"
            >
              <div class="meter" :class="severityOf(group.ratio)">
                <div class="meter-fill" :style="{ width: formatPercent(group.ratio) }"></div>
              </div>
            </div>

            <div class="status-counts">
              <span class="status-count" v-for="status in STATUSES" :key="status.key">
                <span class="color-dot" :class="status.dot"></span>
                {{ status.label }}
                <strong>{{ group.counts[status.key] }}</strong>
              </span>
              <span class="status-count total">
                Total <strong>{{ group.total }}</strong>
              </span>
            </div>

            <table class="task-table">
              <thead>
                <tr>
                  <th scope="col">Tarea</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Fecha medida</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in group.tasks" :key="task.id">
                  <td class="cell-title">{{ task.titulo }}</td>
                  <td class="cell-contact">{{ task.contactName }}</td>
                  <td class="cell-date">
                    {{ formatDate(task.referenceDate) }}
                    <span class="date-kind">{{ task.isDueDate ? 'vencimiento' : 'inicio' }}</span>
                  </td>
                  <td>
                    <span class="status-pill">
                      <span
                        class="color-dot"
                        :class="task.estado === 'Finalizado' ? 'done'
                          : task.estado === 'En curso' ? 'in-progress' : 'pending'"
                      ></span>
                      {{ task.estado || 'Pendiente' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </article>
        </section>
      </template>

      <p v-else class="state-message">
        No hay tareas con vencimiento ni inicio en {{ monthLabel }}.
      </p>
    </div>
  </div>
</template>

<style scoped>
.indicadores-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.indicadores-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  overflow-y: auto;
}

/* Cabecera y selector de mes */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.view-header h2 {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.view-header p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
  max-width: 46ch;
}

.month-picker {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.25rem;
  flex-shrink: 0;
}

.month-nav {
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-sm);
  transition: background 0.2s, color 0.2s;
}

.month-nav:hover {
  background: var(--hover-wash);
  color: var(--text-primary);
}

/* El input nativo va encima y transparente: aporta el calendario del navegador
   sin imponer su tipografía ni su formato de fecha. */
.month-field {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 10rem;
  justify-content: center;
  cursor: pointer;
}

.month-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: capitalize;
  pointer-events: none;
}

.month-field input {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
}

.state-message {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
}

/* Resumen del mes */
.summary {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 3fr;
  gap: 1rem;
  align-items: stretch;
}

.hero {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  padding: 1.25rem;
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.hero-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
}

.hero-value {
  font-size: 3rem;
  font-weight: 600;
  line-height: 1.1;
  color: var(--text-primary);
}

.hero-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.stat-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.4rem;
  padding: 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Bloques por proyecto */
.projects {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.project-card {
  padding: 1.25rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
}

.project-name {
  font-size: 1.05rem;
  color: var(--text-primary);
  margin: 0;
}

.project-ratio {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--text-primary);
}

.project-ratio-note {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Medidor: un solo tono con severidad. La pista es un paso claro del mismo
   color, de modo que el estado se lee a lo largo de toda la barra. */
.meter-wrap {
  padding: 0.9rem 0;
  cursor: default;
}

.meter {
  height: 10px;
  background: var(--bg-inset);
  border-radius: 0 4px 4px 0;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: 0 4px 4px 0;
  transition: width 0.3s ease;
}

.meter.good { background: color-mix(in srgb, var(--success-color) 15%, transparent); }
.meter.warning { background: color-mix(in srgb, var(--warning-color) 15%, transparent); }
.meter.critical { background: color-mix(in srgb, var(--danger-color) 15%, transparent); }

.meter.good .meter-fill { background: var(--success-color); }
.meter.warning .meter-fill { background: var(--warning-color); }
.meter.critical .meter-fill { background: var(--danger-color); }

.status-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.status-count {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.status-count strong {
  color: var(--text-primary);
}

.status-count.total {
  margin-left: auto;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.color-dot.pending { background: var(--danger-color); }
.color-dot.in-progress { background: var(--warning-color); }
.color-dot.done { background: var(--success-color); }

/* Detalle: la vista de tabla que respalda las cifras */
.task-table {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.task-table th {
  text-align: left;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  padding: 0.5rem 0.75rem 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.task-table td {
  padding: 0.6rem 0.75rem 0.6rem 0;
  border-bottom: 1px solid var(--hover-wash);
  color: var(--text-secondary);
  vertical-align: top;
}

.task-table tr:last-child td {
  border-bottom: none;
}

.cell-title {
  color: var(--text-primary);
  font-weight: 500;
}

.cell-date {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.date-kind {
  display: block;
  font-size: 0.7rem;
  color: var(--text-muted);
  font-variant-numeric: normal;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 768px) {
  .indicadores-container {
    padding: 1rem;
    gap: 1rem;
  }

  .view-header {
    flex-direction: column;
    align-items: stretch;
  }

  .view-header h2 {
    font-size: 1.25rem;
  }

  .month-picker {
    justify-content: space-between;
  }

  .summary {
    grid-template-columns: 1fr;
  }

  .hero-value {
    font-size: 2.5rem;
  }

  .stat-tiles {
    grid-template-columns: repeat(2, 1fr);
  }

  /* La tabla scrollea dentro de su tarjeta, la página nunca en horizontal */
  .task-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }

  .status-count.total {
    margin-left: 0;
  }
}
</style>
