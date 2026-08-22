<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import TaskFormModal from '../components/matrix/TaskFormModal.vue'
import { useTasks } from '../composables/useTasks'
import { useProjects } from '../composables/useProjects'
import { useContacts } from '../composables/useContacts'
import { useNotifications } from '../composables/useNotifications'
import { useFilters, parseDateTime } from '../composables/useFilters'

const { tasks, updateTask } = useTasks()
const { projects } = useProjects()
const { contacts } = useContacts()
const { notifySuccess, notifyError } = useNotifications()
const { filterDateType, filterDateRange, filterSingleDate, matchesFilters } = useFilters()

// --- Constantes de tiempo y layout ---
const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_COL_WIDTH = 90       // px por cada día en modo "Días" (ancho ideal)
const MIN_DAY_COL_WIDTH = 45   // px mínimo al comprimir para evitar el scroll
const COMPACT_LABEL_WIDTH = 58 // por debajo de este ancho la cabecera muestra solo el día
const HOUR_COL_WIDTH = 70      // px por cada hora en modo "24 Horas"

// --- Ancho visible del área del gráfico (para comprimir columnas si hay scroll) ---
const chartEl = ref(null)
const chartViewportWidth = ref(0)

let resizeObserver = null
watch(chartEl, (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null

  if (!el) {
    chartViewportWidth.value = 0
    return
  }

  chartViewportWidth.value = el.clientWidth
  resizeObserver = new ResizeObserver(([entry]) => {
    chartViewportWidth.value = entry.contentRect.width
  })
  resizeObserver.observe(el)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

// Ancho de columna en modo "Días": usa el ideal si todo cabe en pantalla y,
// solo cuando se desbordaría (aparecería scroll), lo comprime hasta el mínimo.
const fitDayColWidth = (unitCount) => {
  const viewport = chartViewportWidth.value
  if (!viewport || unitCount === 0) return DAY_COL_WIDTH
  if (unitCount * DAY_COL_WIDTH <= viewport) return DAY_COL_WIDTH
  return Math.max(MIN_DAY_COL_WIDTH, Math.floor(viewport / unitCount))
}

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

// "YYYY-MM-DD" en hora local: el formato que usan los filtros y Firestore.
// No sirve toISOString(), que convierte a UTC y puede saltar de día.
const toISODate = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Pinchar una columna de día abre ese día en detalle: fija el filtro de periodo
// a esa fecha y devuelve la vista a 'auto', que para un día concreto resuelve a
// las 24 horas. Guardamos el periodo previo para poder deshacerlo.
const previousPeriod = ref(null)

const focusDay = (unit) => {
  if (!unit.date) return
  previousPeriod.value = {
    type: filterDateType.value,
    single: filterSingleDate.value,
    mode: userViewMode.value
  }
  filterDateType.value = 'dia'
  filterSingleDate.value = unit.date
  userViewMode.value = 'auto'
}

const exitDayFocus = () => {
  if (!previousPeriod.value) return
  filterDateType.value = previousPeriod.value.type
  filterSingleDate.value = previousPeriod.value.single
  userViewMode.value = previousPeriod.value.mode
  previousPeriod.value = null
}

// Si el usuario toca el filtro de periodo por su cuenta, el "volver" deja de
// tener sentido: ya no venimos de aquel día.
watch(filterDateType, (type) => {
  if (type !== 'dia') previousPeriod.value = null
})

// Filtramos tareas que tengan al menos una fecha y calculamos su rango real
const ganttTasks = computed(() => {
  // Filtrado compartido con la vista Matriz (ver useFilters.matchesFilters)
  const decorated = tasks.value.filter(matchesFilters)
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

  // Los proyectos se ordenan entre sí por su tarea más temprana, de forma que
  // el diagrama sigue leyéndose en diagonal de arriba a abajo. "Sin Proyecto"
  // cierra siempre la lista.
  const projectStart = new Map()
  decorated.forEach(t => {
    const key = t.proyecto_id || ''
    const start = t.startDate.getTime()
    if (!projectStart.has(key) || start < projectStart.get(key)) {
      projectStart.set(key, start)
    }
  })

  return decorated.sort((a, b) => {
    const aProject = a.proyecto_id || ''
    const bProject = b.proyecto_id || ''

    if (aProject !== bProject) {
      if (!aProject) return 1
      if (!bProject) return -1
      return (projectStart.get(aProject) - projectStart.get(bProject)) ||
        a.projectName.localeCompare(b.projectName, 'es')
    }

    // Dentro del proyecto: por inicio y, a igualdad, por fin
    return (a.startDate - b.startDate) || (a.endDate - b.endDate)
  })
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
      const label = `${i.toString().padStart(2, '0')}:00`
      units.push({
        label,
        shortLabel: label,
        isWeekend: false
      })
    }

    const colWidth = HOUR_COL_WIDTH
    return { minDate, maxDate, units, colWidth, isCompact: false, chartWidth: units.length * colWidth }
  }

  // --- Modo Días: N columnas de 1 día exacto ---
  if (ganttTasks.value.length === 0) {
    const today = startOfDay(new Date())
    const maxDate = new Date(today.getTime() + DAY_MS)
    const units = [{
      label: today.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      shortLabel: String(today.getDate()),
      date: toISODate(today),
      isWeekend: today.getDay() === 0 || today.getDay() === 6
    }]
    return { minDate: today, maxDate, units, colWidth: DAY_COL_WIDTH, isCompact: false, chartWidth: DAY_COL_WIDTH }
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
      shortLabel: String(cursor.getDate()),
      date: toISODate(cursor),
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  // Se comprime solo si con el ancho ideal habría scroll horizontal
  const colWidth = fitDayColWidth(units.length)
  return {
    minDate,
    maxDate,
    units,
    colWidth,
    isCompact: colWidth < COMPACT_LABEL_WIDTH,
    chartWidth: units.length * colWidth
  }
})

// Tareas que realmente caen dentro del eje dibujado. En modo "24 Horas" el eje
// es un único día, así que las tareas de otros días quedaban como filas vacías:
// nombre en el panel lateral y ninguna barra en el gráfico.
const visibleTasks = computed(() => {
  let list = ganttTasks.value

  if (viewMode.value === 'hours') {
    const { minDate, maxDate } = calendarRange.value
    list = list.filter(t => t.endDate > minDate && t.startDate < maxDate)
  }

  // Marcamos la primera fila de cada proyecto para separar visualmente los
  // grupos. Se calcula aquí, sobre la lista ya recortada: si se hiciera sobre
  // ganttTasks, en modo 24 horas la marca podría caer en una fila filtrada.
  return list.map((task, index) => ({
    ...task,
    isProjectStart: index > 0 && list[index - 1].proyecto_id !== task.proyecto_id
  }))
})

const emptyMessage = computed(() =>
  viewMode.value === 'hours'
    ? 'No hay tareas programadas en el día seleccionado.'
    : 'No hay tareas con fechas asignadas para mostrar en el diagrama.'
)

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
  if (estado === 'En curso') return 'var(--warning-color)' // Ámbar
  if (estado === 'Finalizado') return 'var(--success-color)' // Verde
  return 'var(--danger-color)' // Rojo (Pendiente)
}

// --- Edición: las barras y las filas del panel abren la tarea ---
const isTaskModalOpen = ref(false)
const taskToEdit = ref(null)

const openEditModal = (task) => {
  // Solo los campos de la tarea: startDate/endDate y las etiquetas de cuadrante
  // son datos derivados del diagrama, no deben viajar al formulario.
  const {
    startDate, endDate, projectName, quadrantName, quadrantClass,
    durationDays, isProjectStart, ...taskData
  } = task
  taskToEdit.value = taskData
  isTaskModalOpen.value = true
}

const saveTask = async (taskData) => {
  try {
    await updateTask(taskToEdit.value.id, taskData)
    notifySuccess('Tarea actualizada', taskData.titulo)
  } catch (err) {
    notifyError('No se pudo guardar la tarea', err.message)
  }
}

// --- Encuadre inicial: el gráfico abre sobre la primera tarea ---
// Sin esto, un día cuya primera tarea es a las 15:00 se abre mirando la
// madrugada vacía. Si no hay tareas no tocamos el scroll.
// Última posición que fijamos nosotros, para distinguirla de un scroll manual.
let framedScrollLeft = null

// La tarea más temprana del eje. No es visibleTasks[0]: las filas van agrupadas
// por proyecto, así que la primera fila puede empezar más tarde que otra de un
// grupo posterior.
const framingTask = computed(() =>
  visibleTasks.value.reduce(
    (earliest, task) => (!earliest || task.startDate < earliest.startDate) ? task : earliest,
    null
  )
)

const scrollToFirstTask = () => {
  const el = chartEl.value
  const firstTask = framingTask.value
  if (!el || !firstTask) return

  const { minDate, colWidth } = calendarRange.value
  const unitMs = viewMode.value === 'hours' ? HOUR_MS : DAY_MS
  const startMs = Math.max(firstTask.startDate.getTime(), minDate.getTime())
  const leftPx = (startMs - minDate.getTime()) * (colWidth / unitMs)

  // Media columna de aire para que la barra no quede pegada al borde
  el.scrollLeft = Math.max(0, leftPx - colWidth / 2)
  framedScrollLeft = el.scrollLeft // releído: el navegador acota al máximo real
}

// Solo reencuadramos cuando cambia el eje (modo, día en foco) o la primera
// tarea. La firma es un string a propósito: un getter que devolviera un objeto
// o un array sería siempre "distinto" y el watcher saltaría en cada recálculo
// de calendarRange —incluido el del ResizeObserver—, devolviendo el scroll al
// inicio cada vez que el usuario redimensiona la ventana.
const chartFramingKey = computed(() => [
  chartEl.value ? 'ready' : 'pending',
  viewMode.value,
  calendarRange.value.minDate.getTime(),
  framingTask.value?.id ?? ''
].join('|'))

watch(chartFramingKey, scrollToFirstTask, { flush: 'post' })

// El primer encuadre en modo Días se calcula con el ancho de columna ideal,
// porque el ResizeObserver aún no ha medido el gráfico. Cuando mide y las
// columnas se comprimen, ese scrollLeft se queda largo y recorta la primera
// tarea. Reencuadramos al asentarse el ancho, pero solo si el usuario no ha
// movido el scroll: si lo tocó, manda él. (En 24 horas colWidth es fijo, de ahí
// que allí no se notara.)
watch(() => calendarRange.value.colWidth, () => {
  const el = chartEl.value
  if (!el || framedScrollLeft === null) return
  if (Math.abs(el.scrollLeft - framedScrollLeft) > 1) return
  scrollToFirstTask()
}, { flush: 'post' })

// Mantiene los nombres del panel lateral alineados con sus barras: el área del
// gráfico es la única que scrollea en vertical y el panel la sigue.
const sidebarBodyEl = ref(null)
const chartRowsEl = ref(null)

const syncSidebarScroll = (event) => {
  if (sidebarBodyEl.value) sidebarBodyEl.value.scrollTop = event.target.scrollTop
}

// El panel no tiene scroll propio, así que su rueda mueve el gráfico (y este,
// al scrollear, arrastra al panel). Sin esto sería una zona muerta.
const forwardSidebarWheel = (event) => {
  if (!chartRowsEl.value) return
  chartRowsEl.value.scrollTop += event.deltaY
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
        <div class="header-controls">
          <button
            v-if="previousPeriod"
            class="btn-back"
            title="Volver al periodo que estabas viendo"
            @click="exitDayFocus"
          >← Volver</button>

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
      </div>

      <div v-if="visibleTasks.length === 0" class="empty-state">
        <p>{{ emptyMessage }}</p>
      </div>

      <div v-else class="gantt-wrapper">
        <!-- Panel lateral con nombres de tareas -->
        <div class="gantt-sidebar">
          <div class="sidebar-header">Tarea / Proyecto</div>
          <div class="sidebar-body" ref="sidebarBodyEl" @wheel.prevent="forwardSidebarWheel">
            <button
              class="sidebar-row"
              :class="{ 'is-project-start': task.isProjectStart }"
              v-for="task in visibleTasks"
              :key="'side-'+task.id"
              :title="`Editar ${task.titulo}`"
              @click="openEditModal(task)"
            >
              <div class="task-info">
                <div class="task-title-wrap">
                  <span class="quadrant-dot" :class="task.quadrantClass" :title="task.quadrantName"></span>
                  <span class="task-title" :title="task.titulo">{{ task.titulo }}</span>
                </div>
                <span class="task-project">{{ task.projectName }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Área del gráfico -->
        <div class="gantt-chart" ref="chartEl">
          <!-- Eje de fechas/horas -->
          <div
            class="chart-timeline"
            :style="{ gridTemplateColumns: `repeat(${calendarRange.units.length}, ${calendarRange.colWidth}px)`, width: `${calendarRange.chartWidth}px` }"
          >
            <button
              v-for="(unit, index) in calendarRange.units"
              :key="'header-'+index"
              class="timeline-day"
              :class="{ 'is-weekend': unit.isWeekend, 'is-compact': calendarRange.isCompact }"
              :disabled="!unit.date"
              :title="unit.date ? `Ver el ${unit.label} hora a hora` : unit.label"
              @click="focusDay(unit)"
            >
              {{ calendarRange.isCompact ? unit.shortLabel : unit.label }}
            </button>
          </div>

          <!-- Filas de tareas -->
          <div
            class="chart-rows"
            ref="chartRowsEl"
            :style="{ width: `${calendarRange.chartWidth}px` }"
            @scroll="syncSidebarScroll"
          >
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
                :class="{ 'is-project-start': task.isProjectStart }"
                v-for="task in visibleTasks"
                :key="'bar-'+task.id"
              >
                <button
                  class="task-bar"
                  :style="getTaskGridStyle(task)"
                  :title="`${task.titulo} (${task.estado}) - ${task.startDate.toLocaleTimeString()} a ${task.endDate.toLocaleTimeString()}`"
                  @click="openEditModal(task)"
                >
                  <span class="bar-label">{{ task.titulo }}</span>
                </button>
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

    <TaskFormModal
      :is-open="isTaskModalOpen"
      :task="taskToEdit"
      :projects="projects"
      :contacts="contacts"
      @close="isTaskModalOpen = false"
      @save="saveTask"
    />
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

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* Deshace el "abrir día" y devuelve el periodo anterior */
.btn-back {
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.5rem 0.8rem;
  border-radius: var(--radius-md);
  transition: color 0.2s, border-color 0.2s;
  white-space: nowrap;
}

.btn-back:hover {
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

/* Toggle de vista Días / 24 Horas */
.view-toggle {
  display: flex;
  gap: 0.25rem;
  background: var(--bg-header);
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
  background: var(--bg-header);
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

/* El panel no tiene barra propia: sigue al scroll del gráfico (syncSidebarScroll) */
.sidebar-body {
  flex: 1;
  overflow: hidden;
}

.sidebar-row {
  height: 50px;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  border-bottom: 1px solid var(--hover-wash);
  background: transparent;
  font-size: inherit;
  text-align: left;
  transition: background 0.15s;
}

.sidebar-row:hover {
  background: var(--hover-wash);
}

/* Separador entre grupos de proyecto. Va en ambas columnas (panel y gráfico)
   y con box-sizing: border-box no altera los 50px de fila, así que los nombres
   siguen alineados con sus barras. */
.sidebar-row.is-project-start,
.task-row-wrapper.is-project-start {
  border-top: 1px solid var(--border-color);
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
  color: var(--info-color);
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
  background: var(--bg-inset);
}

.timeline-day {
  height: 40px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: transparent;
  border-right: 1px solid var(--hover-wash);
  overflow: hidden;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

/* Un día se puede abrir en detalle (24 horas); una hora ya es el detalle */
.timeline-day:disabled {
  cursor: default;
}

/* Columnas comprimidas: la cabecera muestra solo el número de día */
.timeline-day.is-compact {
  font-size: 0.7rem;
  padding: 0;
}

.timeline-day.is-weekend {
  color: var(--q4-color);
  background: var(--stripe-wash);
}

/* Mismo par acento/blanco que el resto de acciones primarias (.btn-create) */
.timeline-day:not(:disabled):hover {
  background: var(--accent-primary);
  color: white;
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
  border-right: 1px solid var(--hover-wash);
}

.grid-line.is-weekend {
  background: var(--stripe-wash);
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
  text-align: left;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s;
  cursor: pointer;
  overflow: hidden;
}

.task-bar:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.bar-label {
  /* El color se invierte con el tema: ver --on-color-text en main.css */
  color: var(--on-color-text);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  background: var(--bg-header);
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
.color-dot.pending { background: var(--danger-color); }
.color-dot.in-progress { background: var(--warning-color); }
.color-dot.done { background: var(--success-color); }

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

  /* Controles a todo el ancho, botones equitativos */
  .header-controls {
    width: 100%;
  }

  .btn-back {
    flex: 1;
    text-align: center;
  }

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
