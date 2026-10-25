<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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

const QUADRANTS = [
  { key: 'q1', label: 'Hacer', hint: 'Urgente e importante' },
  { key: 'q2', label: 'Decidir', hint: 'Importante, no urgente' },
  { key: 'q3', label: 'Delegar', hint: 'Urgente, no importante' },
  { key: 'q4', label: 'Eliminar', hint: 'Ni urgente ni importante' }
]

const quadrantOf = (task) => {
  if (task.es_urgente && task.es_importante) return 'q1'
  if (task.es_importante) return 'q2'
  if (task.es_urgente) return 'q3'
  return 'q4'
}

// --- Fechas ("YYYY-MM-DD" y "YYYY-MM", siempre en horario local) ---
const pad = (n) => String(n).padStart(2, '0')
const toMonthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
const toISODate = (date) => `${toMonthKey(date)}-${pad(date.getDate())}`

const addMonths = (monthKey, delta) => {
  const [year, month] = monthKey.split('-').map(Number)
  return toMonthKey(new Date(year, month - 1 + delta, 1))
}

const monthName = (monthKey, options) => {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-ES', options)
}

const selectedMonth = ref(toMonthKey(new Date()))

// Si el usuario vacía el input de mes, volvemos al último mes válido
watch(selectedMonth, (value, previous) => {
  if (!value) selectedMonth.value = previous || toMonthKey(new Date())
})

const monthLabel = computed(() => monthName(selectedMonth.value, { month: 'long', year: 'numeric' }))
const previousMonth = computed(() => addMonths(selectedMonth.value, -1))
const previousMonthLabel = computed(() => monthName(previousMonth.value, { month: 'long' }))

const shiftMonth = (delta) => {
  selectedMonth.value = addMonths(selectedMonth.value, delta)
}

// --- Qué tareas entran en la medición ---
// Una tarea cuenta en el mes de su fecha de vencimiento. Si no tiene, cuenta en
// el de su fecha de inicio. Sin ninguna de las dos no es medible y queda fuera.
// Comparamos los strings "YYYY-MM-DD" recortados, no objetos Date: así el mes
// es el que el usuario escribió, sin que la zona horaria lo desplace un día.
const referenceOf = (task) => task.fecha_vencimiento || task.fecha_inicio

const inScope = (task) => {
  if (filterProject.value !== 'Todos' && task.proyecto_id !== filterProject.value) return false
  if (filterContact.value !== 'Todos' && task.contacto_id !== filterContact.value) return false
  return true
}

const todayISO = computed(() => {
  tasks.value // se recalcula al cambiar los datos, que es cuando se consulta
  return toISODate(new Date())
})

const decorate = (task) => {
  const project = projects.value.find(p => p.id === task.proyecto_id)
  const contact = contacts.value.find(c => c.id === task.contacto_id)
  const referenceDate = referenceOf(task)
  const isDone = task.estado === 'Finalizado'

  // Entrega: solo medible si se registró cuándo se finalizó (campo finalizado_at,
  // que se guarda desde que existe; las anteriores quedan "sin registro").
  let delivery = null
  if (isDone) {
    if (!task.finalizado_at) delivery = 'unknown'
    else delivery = task.finalizado_at <= referenceDate ? 'on-time' : 'late'
  }

  return {
    ...task,
    projectName: project ? project.nombre : 'Sin Proyecto',
    contactName: contact ? contact.nombre : '—',
    quadrant: quadrantOf(task),
    referenceDate,
    isDueDate: Boolean(task.fecha_vencimiento),
    isOverdue: !isDone && referenceDate < todayISO.value,
    delivery
  }
}

const tasksOfMonth = (monthKey) =>
  tasks.value
    .filter(task => {
      if (!inScope(task)) return false
      const reference = referenceOf(task)
      return Boolean(reference) && reference.slice(0, 7) === monthKey
    })
    .map(decorate)

const monthTasks = computed(() => tasksOfMonth(selectedMonth.value))

// Tareas que cumplen los filtros pero no tienen ninguna fecha: no se pueden medir
const undatedCount = computed(() =>
  tasks.value.filter(task => inScope(task) && !referenceOf(task)).length
)

// Un estado desconocido cuenta como pendiente: las partes tienen que sumar
// siempre el total, o el indicador miente.
const summarize = (list) => {
  const counts = { 'Finalizado': 0, 'En curso': 0, 'Pendiente': 0 }
  let overdue = 0
  let onTime = 0
  let late = 0

  list.forEach(task => {
    counts[counts[task.estado] === undefined ? 'Pendiente' : task.estado] += 1
    if (task.isOverdue) overdue += 1
    if (task.delivery === 'on-time') onTime += 1
    if (task.delivery === 'late') late += 1
  })

  return {
    total: list.length,
    counts,
    overdue,
    onTime,
    late,
    tracked: onTime + late,
    ratio: list.length ? counts['Finalizado'] / list.length : 0
  }
}

const monthSummary = computed(() => summarize(monthTasks.value))

// Finalizadas de las que no se sabe cuándo se cerraron (anteriores al registro)
const untrackedDone = computed(() => monthSummary.value.counts['Finalizado'] - monthSummary.value.tracked)

// --- Comparativa con el mes anterior ---
const previousSummary = computed(() => summarize(tasksOfMonth(previousMonth.value)))

const delta = computed(() => {
  if (!previousSummary.value.total || !monthSummary.value.total) return null
  const points = Math.round((monthSummary.value.ratio - previousSummary.value.ratio) * 100)
  return {
    points,
    trend: points > 0 ? 'up' : points < 0 ? 'down' : 'flat',
    symbol: points > 0 ? '▲' : points < 0 ? '▼' : '■',
    text: points === 0
      ? `igual que ${previousMonthLabel.value}`
      : `${points > 0 ? '+' : ''}${points} pts vs ${previousMonthLabel.value}`
  }
})

// --- Tendencia: cumplimiento de los últimos 6 meses (el seleccionado, el último) ---
const trend = computed(() =>
  [-5, -4, -3, -2, -1, 0].map(offset => {
    const key = addMonths(selectedMonth.value, offset)
    const summary = summarize(tasksOfMonth(key))
    return {
      key,
      label: monthName(key, { month: 'short' }).replace('.', ''),
      total: summary.total,
      ratio: summary.ratio,
      current: offset === 0
    }
  })
)

// --- Distribución por cuadrante ---
const quadrantStats = computed(() => {
  const total = monthTasks.value.length
  return QUADRANTS.map(quadrant => {
    const count = monthTasks.value.filter(task => task.quadrant === quadrant.key).length
    return { ...quadrant, count, share: total ? count / total : 0 }
  })
})

// --- Agrupación: por proyecto o por responsable ---
const groupBy = ref('proyecto')

const groups = computed(() => {
  const byProject = groupBy.value === 'proyecto'
  const map = new Map()

  monthTasks.value.forEach(task => {
    const key = (byProject ? task.proyecto_id : task.contacto_id) || ''
    if (!map.has(key)) {
      const name = byProject ? task.projectName : (key ? task.contactName : 'Sin responsable')
      map.set(key, { id: key, name, tasks: [] })
    }
    map.get(key).tasks.push(task)
  })

  return [...map.values()]
    .map(group => ({
      ...group,
      ...summarize(group.tasks),
      // Dentro del grupo, por la fecha que se está midiendo
      tasks: [...group.tasks].sort((a, b) =>
        a.referenceDate.localeCompare(b.referenceDate) ||
        a.titulo.localeCompare(b.titulo, 'es')
      )
    }))
    .sort((a, b) => {
      if (!a.id) return 1  // el grupo "Sin ..." cierra el informe
      if (!b.id) return -1
      return a.name.localeCompare(b.name, 'es')
    })
})

// La columna que acompaña a la tarea es la dimensión que NO se agrupa
const otherColumnLabel = computed(() => groupBy.value === 'proyecto' ? 'Responsable' : 'Proyecto')
const otherColumnValue = (task) => groupBy.value === 'proyecto' ? task.contactName : task.projectName

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
  `de ${group.total}` +
  (group.overdue ? `, ${group.overdue} vencidas` : '')

const DELIVERY_LABELS = { 'on-time': 'A tiempo', late: 'Con retraso', unknown: 'Sin registro' }

// --- Exportar / imprimir ---
// Las celdas que empiezan por = + - @ las interpretaría Excel como fórmula
const csvCell = (value) => {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

const exportCsv = () => {
  const header = [
    'Mes', 'Proyecto', 'Responsable', 'Tarea', 'Cuadrante', 'Estado',
    'Fecha medida', 'Tipo de fecha', 'Vencida', 'Entrega', 'Finalizada el'
  ]

  const rows = [...monthTasks.value]
    .sort((a, b) =>
      a.projectName.localeCompare(b.projectName, 'es') ||
      a.referenceDate.localeCompare(b.referenceDate) ||
      a.titulo.localeCompare(b.titulo, 'es')
    )
    .map(task => [
      selectedMonth.value,
      task.projectName,
      task.contactName === '—' ? '' : task.contactName,
      task.titulo,
      QUADRANTS.find(q => q.key === task.quadrant).label,
      task.estado || 'Pendiente',
      task.referenceDate,
      task.isDueDate ? 'vencimiento' : 'inicio',
      task.isOverdue ? 'Sí' : 'No',
      task.delivery ? DELIVERY_LABELS[task.delivery] : '',
      task.finalizado_at || ''
    ])

  // BOM + ";" para que Excel en español lo abra con acentos y columnas
  const csv = '﻿' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `indicadores-${selectedMonth.value}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const printReport = () => window.print()

// --- Cabecera del informe impreso (solo se ve en el papel / PDF) ---
const scopeProjectLabel = computed(() => {
  if (filterProject.value === 'Todos') return 'Todos'
  return projects.value.find(p => p.id === filterProject.value)?.nombre || 'Todos'
})

const scopeContactLabel = computed(() => {
  if (filterContact.value === 'Todos') return 'Todos'
  return contacts.value.find(c => c.id === filterContact.value)?.nombre || 'Todos'
})

// Se refresca justo antes de imprimir (botón o Ctrl+P), no al abrir la vista
const generatedAt = ref('')
const stampGeneratedAt = () => {
  generatedAt.value = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
}

onMounted(() => {
  stampGeneratedAt()
  window.addEventListener('beforeprint', stampGeneratedAt)
})
onBeforeUnmount(() => window.removeEventListener('beforeprint', stampGeneratedAt))
</script>

<template>
  <div class="indicadores-view">
    <div class="glass-panel indicadores-container">
      <header class="print-header">
        <h1>Indicadores de cumplimiento — {{ monthLabel }}</h1>
        <p>
          Proyecto: <strong>{{ scopeProjectLabel }}</strong> ·
          Responsable: <strong>{{ scopeContactLabel }}</strong> ·
          Generado el {{ generatedAt }}
        </p>
        <p>
          Cada tarea se mide en el mes de su fecha de vencimiento; si no tiene,
          en el de su fecha de inicio. Agenda EH.
        </p>
      </header>

      <div class="view-header no-print">
        <div class="view-header-text">
          <h2>Indicadores de cumplimiento</h2>
          <p>
            Cada tarea se mide en el mes de su fecha de vencimiento; si no tiene,
            en el de su fecha de inicio.
          </p>
        </div>

        <div class="header-controls">
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

          <div class="report-actions no-print">
            <button class="action-btn" :disabled="!monthSummary.total" @click="exportCsv">Exportar CSV</button>
            <button class="action-btn" :disabled="!monthSummary.total" @click="printReport">Imprimir</button>
          </div>
        </div>
      </div>

      <p v-if="undatedCount" class="undated-note">
        {{ undatedCount }} {{ undatedCount === 1 ? 'tarea sin fecha no se incluye' : 'tareas sin fecha no se incluyen' }}
        en los indicadores.
      </p>

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
            <span v-if="delta" class="hero-delta" :class="delta.trend">
              <span aria-hidden="true">{{ delta.symbol }}</span> {{ delta.text }}
            </span>
            <span v-else class="hero-delta none">Sin datos de {{ previousMonthLabel }} para comparar</span>
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
            <div class="stat-tile" :class="{ alert: monthSummary.overdue > 0 }">
              <span class="stat-label">Vencidas</span>
              <span class="stat-value">{{ monthSummary.overdue }}</span>
              <span class="stat-hint">sin finalizar y con fecha pasada</span>
            </div>
            <div class="stat-tile" v-if="monthSummary.tracked > 0">
              <span class="stat-label">Entregadas a tiempo</span>
              <span class="stat-value">{{ monthSummary.onTime }}<span class="stat-of"> / {{ monthSummary.tracked }}</span></span>
              <span class="stat-hint">
                {{ formatPercent(monthSummary.onTime / monthSummary.tracked) }}
                <template v-if="untrackedDone > 0">· {{ untrackedDone }} sin registro</template>
              </span>
            </div>
          </div>
        </section>

        <!-- Tendencia y distribución por cuadrante -->
        <section class="insights">
          <article class="insight-card">
            <h3 class="insight-title">Cumplimiento, últimos 6 meses</h3>
            <div class="trend" role="group" aria-label="Cumplimiento de los últimos 6 meses">
              <button
                v-for="month in trend"
                :key="month.key"
                class="trend-col"
                :class="{ current: month.current }"
                :disabled="!month.total"
                :title="month.total ? `${month.label}: ${formatPercent(month.ratio)} de ${month.total} tareas` : `${month.label}: sin tareas`"
                :aria-label="month.total ? `${month.label}: ${formatPercent(month.ratio)} de ${month.total} tareas` : `${month.label}: sin tareas`"
                @click="selectedMonth = month.key"
              >
                <span class="trend-value">{{ month.total ? formatPercent(month.ratio) : '—' }}</span>
                <span class="trend-track">
                  <span
                    class="trend-bar"
                    :class="severityOf(month.ratio)"
                    :style="{ height: month.total ? Math.max(month.ratio * 100, 3) + '%' : '0%' }"
                  ></span>
                </span>
                <span class="trend-label">{{ month.label }}</span>
              </button>
            </div>
          </article>

          <article class="insight-card">
            <h3 class="insight-title">Distribución por cuadrante</h3>
            <ul class="quadrants">
              <li v-for="quadrant in quadrantStats" :key="quadrant.key" class="quadrant-row">
                <span class="quadrant-name">
                  <span class="quadrant-swatch" :class="quadrant.key"></span>
                  {{ quadrant.label }}
                  <span class="quadrant-hint">{{ quadrant.hint }}</span>
                </span>
                <span class="quadrant-bar-track">
                  <span class="quadrant-bar" :class="quadrant.key" :style="{ width: formatPercent(quadrant.share) }"></span>
                </span>
                <span class="quadrant-count">{{ quadrant.count }} <small>({{ formatPercent(quadrant.share) }})</small></span>
              </li>
            </ul>
          </article>
        </section>

        <!-- Un bloque por proyecto o por responsable -->
        <div class="groups-header">
          <h3>Detalle por {{ groupBy === 'proyecto' ? 'proyecto' : 'responsable' }}</h3>
          <div class="segmented no-print" role="group" aria-label="Agrupar por">
            <button :class="{ active: groupBy === 'proyecto' }" :aria-pressed="groupBy === 'proyecto'" @click="groupBy = 'proyecto'">Proyecto</button>
            <button :class="{ active: groupBy === 'responsable' }" :aria-pressed="groupBy === 'responsable'" @click="groupBy = 'responsable'">Responsable</button>
          </div>
        </div>

        <section class="projects">
          <article
            class="project-card"
            v-for="group in groups"
            :key="groupBy + '-' + (group.id || 'sin')"
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
              <span v-if="group.overdue" class="status-count overdue">
                Vencidas <strong>{{ group.overdue }}</strong>
              </span>
              <span class="status-count total">
                Total <strong>{{ group.total }}</strong>
              </span>
            </div>

            <table class="task-table">
              <thead>
                <tr>
                  <th scope="col">Tarea</th>
                  <th scope="col">{{ otherColumnLabel }}</th>
                  <th scope="col">Fecha medida</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in group.tasks" :key="task.id">
                  <td class="cell-title">{{ task.titulo }}</td>
                  <td class="cell-contact">{{ otherColumnValue(task) }}</td>
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
                    <span v-if="task.isOverdue" class="tag tag-overdue">Vencida</span>
                    <span v-else-if="task.delivery === 'on-time'" class="tag tag-ok">A tiempo</span>
                    <span v-else-if="task.delivery === 'late'" class="tag tag-late">Con retraso</span>
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

/* --- Cabecera: selector de mes + acciones --- */
.header-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.report-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: var(--hover-wash);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.undated-note {
  margin: 0;
  padding: 0.6rem 0.9rem;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* --- Comparativa con el mes anterior --- */
.hero-delta {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.hero-delta.up { color: var(--success-color); }
.hero-delta.down { color: var(--danger-color); }
.hero-delta.flat,
.hero-delta.none {
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.stat-of {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.stat-tile.alert {
  border-color: var(--danger-color);
}

/* --- Tendencia y cuadrantes --- */
.insights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.insight-card {
  padding: 1.25rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.insight-title {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.trend {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
  align-items: end;
}

.trend-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.trend-col:disabled {
  cursor: default;
}

.trend-col:hover:not(:disabled) {
  background: var(--hover-wash);
}

.trend-col.current .trend-label {
  color: var(--text-primary);
  font-weight: 700;
}

.trend-value {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.trend-track {
  display: flex;
  align-items: flex-end;
  width: 70%;
  max-width: 36px;
  height: 110px;
  background: var(--bg-inset);
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}

.trend-bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}

.trend-bar.good { background: var(--success-color); }
.trend-bar.warning { background: var(--warning-color); }
.trend-bar.critical { background: var(--danger-color); }

.trend-label {
  font-size: 0.75rem;
  text-transform: capitalize;
}

.quadrants {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.quadrant-row {
  display: grid;
  grid-template-columns: minmax(110px, 1.2fr) 2fr auto;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.quadrant-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.4rem;
}

.quadrant-hint {
  width: 100%;
  padding-left: 1.1rem;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.quadrant-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.quadrant-bar-track {
  height: 10px;
  background: var(--bg-inset);
  border-radius: 0 4px 4px 0;
  overflow: hidden;
}

.quadrant-bar {
  display: block;
  height: 100%;
  border-radius: 0 4px 4px 0;
  transition: width 0.3s ease;
}

.quadrant-swatch.q1, .quadrant-bar.q1 { background: var(--q1-color); }
.quadrant-swatch.q2, .quadrant-bar.q2 { background: var(--q2-color); }
.quadrant-swatch.q3, .quadrant-bar.q3 { background: var(--q3-color); }
.quadrant-swatch.q4, .quadrant-bar.q4 { background: var(--q4-color); }

.quadrant-count {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.quadrant-count small {
  color: var(--text-muted);
}

/* --- Agrupación --- */
.groups-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.groups-header h3 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text-primary);
}

.segmented {
  display: inline-flex;
  padding: 0.2rem;
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.segmented button {
  padding: 0.3rem 0.9rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
}

.segmented button.active {
  background: var(--accent-primary);
  color: var(--text-inverse);
}

.status-count.overdue strong {
  color: var(--danger-color);
}

/* Marcas junto al estado: llevan texto, el color no es el único canal */
.tag {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.05rem 0.45rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}

.tag-overdue { color: var(--danger-color); }
.tag-ok { color: var(--success-color); }
.tag-late { color: var(--warning-color); }

@media (max-width: 768px) {
  .header-controls {
    align-items: stretch;
  }

  .report-actions .action-btn {
    flex: 1;
  }

  .quadrant-row {
    grid-template-columns: 1fr auto;
  }

  .quadrant-bar-track {
    grid-column: 1 / -1;
    order: 3;
  }
}

/* --- Impresión / PDF: solo el informe --- */
.print-header {
  display: none;
}

@page {
  size: A4;
  margin: 14mm 12mm 16mm;

  @bottom-right {
    content: counter(page) " / " counter(pages);
    font-size: 8pt;
    color: #5a6675;
  }
}

@media print {
  .no-print {
    display: none !important;
  }

  /* Chrome del resto de la app y fondos del tema (el oscuro saldría ilegible) */
  :global(.corp-header),
  :global(.toast-host) {
    display: none !important;
  }

  :global(html),
  :global(body) {
    background: #ffffff !important;
    min-height: 0;
  }

  :global(.app-layout) {
    display: block;
    min-height: 0;
    max-width: none;
    padding: 0;
  }

  :global(.app-main) {
    display: block;
  }

  /* Siempre en claro, también si la pantalla está en tema oscuro */
  .indicadores-view {
    --bg-base: #ffffff;
    --bg-surface: #ffffff;
    --bg-header: #f5f7fa;
    --bg-inset: #e9edf2;
    --text-primary: #1c2531;
    --text-secondary: #3f4a59;
    --text-muted: #5a6675;
    --border-color: #c4ccd8;
    --accent-primary: #35618e;
    --success-color: #3f7d5e;
    --warning-color: #97701f;
    --danger-color: #a8524a;
    --q1-color: #a8524a;
    --q2-color: #35618e;
    --q3-color: #97701f;
    --q4-color: #6b7787;
    --hover-wash: transparent;

    display: block;
    height: auto;
    color: var(--text-primary);
    font-size: 10pt;
    /* Sin esto el navegador omite los fondos y las barras salen vacías */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .indicadores-container {
    display: flex;
    flex: none;
    height: auto;
    overflow: visible;
    padding: 0;
    gap: 10pt;
    background: none;
    border: none;
    box-shadow: none;
  }

  .print-header {
    display: block;
    padding-bottom: 8pt;
    border-bottom: 2px solid var(--accent-primary);
  }

  .print-header h1 {
    margin: 0 0 4pt 0;
    font-size: 16pt;
    color: var(--text-primary);
    text-transform: capitalize;
  }

  .print-header p {
    margin: 0 0 2pt 0;
    font-size: 8.5pt;
    color: var(--text-secondary);
  }

  /* El diseño móvil (max-width: 768px) se activa en papel A4: lo deshacemos */
  .summary {
    grid-template-columns: minmax(150px, 1fr) 3fr;
    gap: 8pt;
  }

  .hero {
    padding: 10pt;
  }

  .hero-value {
    font-size: 28pt;
  }

  .stat-tiles {
    grid-template-columns: repeat(3, 1fr);
    gap: 8pt;
  }

  .stat-tile {
    padding: 8pt;
  }

  .stat-value {
    font-size: 15pt;
  }

  .insights {
    grid-template-columns: 1fr 1fr;
    gap: 8pt;
  }

  .insight-card,
  .project-card {
    padding: 10pt;
    box-shadow: none;
  }

  .insight-card {
    break-inside: avoid;
  }

  .trend-col {
    cursor: default;
    color: var(--text-secondary);
  }

  .trend-track {
    height: 80px;
  }

  .quadrant-row {
    grid-template-columns: minmax(80px, 1.2fr) 1.5fr auto;
  }

  .quadrant-bar-track {
    grid-column: auto;
    order: 0;
  }

  .groups-header {
    break-after: avoid;
  }

  .groups-header h3 {
    font-size: 12pt;
  }

  /* Un proyecto largo puede partirse entre páginas, pero su cabecera no queda
     sola al pie ni una fila se corta por la mitad */
  .project-header,
  .meter-wrap,
  .status-counts {
    break-after: avoid;
  }

  .task-table {
    display: table;
    overflow: visible;
    white-space: normal;
    font-size: 9pt;
  }

  .task-table thead {
    display: table-header-group;
  }

  .task-table tr {
    break-inside: avoid;
  }

  .tag {
    font-size: 7pt;
  }
}
</style>
