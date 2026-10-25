<script setup>
import { computed, ref } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import TaskFormModal from '../components/matrix/TaskFormModal.vue'
import { useTasks } from '../composables/useTasks'
import { useProjects } from '../composables/useProjects'
import { useContacts } from '../composables/useContacts'
import { useNotifications } from '../composables/useNotifications'
import { useTheme } from '../composables/useTheme'

const { tasks, updateTask } = useTasks()
const { projects } = useProjects()
const { contacts } = useContacts()
const { notifyError, notifySuccess } = useNotifications()
const { resolvedTheme, readThemeColors } = useTheme()

// FullCalendar pinta los eventos con estilos en línea, así que necesita colores
// resueltos, no `var(--...)`. Los leemos del CSS para que la paleta siga
// teniendo una sola fuente de verdad, y los recalculamos al cambiar de tema.
const quadrantColors = computed(() => {
  resolvedTheme.value // dependencia explícita: fuerza el recálculo al cambiar el tema
  return readThemeColors(['q1-color', 'q2-color', 'q3-color', 'q4-color', 'on-color-text'])
})

const pad = (n) => String(n).padStart(2, '0')

// Suma días a "YYYY-MM-DD" en horario local.
const shiftDate = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

const colorForTask = (task) => {
  const c = quadrantColors.value
  if (task.es_urgente && task.es_importante) return c['q1-color']    // Hacer
  if (!task.es_urgente && task.es_importante) return c['q2-color']   // Decidir
  if (task.es_urgente && !task.es_importante) return c['q3-color']   // Delegar
  return c['q4-color']                                                // Eliminar
}

// --- Persistencia de cambios hechos arrastrando/redimensionando ---
const persistEventChange = async (info, errorTitle) => {
  const { event } = info

  const newStart = event.startStr.split('T')[0]
  // Para allDay endStr es el día EXCLUSIVO: restamos uno para volver al día de
  // vencimiento real (si no, cada arrastre alargaba la tarea un día).
  let newEnd = newStart
  if (event.endStr) {
    const endDay = event.endStr.split('T')[0]
    newEnd = event.allDay ? shiftDate(endDay, -1) : endDay
    if (newEnd < newStart) newEnd = newStart
  }

  const updatePayload = { fecha_inicio: newStart, fecha_vencimiento: newEnd }

  if (event.allDay) {
    // Pasó (o sigue) en la franja de día completo: no deben quedar horas viejas
    updatePayload.con_hora = false
    updatePayload.hora_inicio = ''
    updatePayload.hora_vencimiento = ''
  } else {
    updatePayload.con_hora = true
    updatePayload.hora_inicio = event.startStr.split('T')[1].substring(0, 5) // "HH:MM"
    updatePayload.hora_vencimiento = event.endStr && event.endStr.includes('T')
      ? event.endStr.split('T')[1].substring(0, 5)
      : ''
  }

  try {
    await updateTask(event.id, updatePayload)
  } catch (e) {
    // Solo revertimos si falló Firestore: los fallos de Google se avisan aparte
    info.revert()
    notifyError(errorTitle, e.message)
  }
}

// --- Edición desde el calendario ---
const isModalOpen = ref(false)
const isSavingTask = ref(false)
const taskToEdit = ref(null)

const saveTask = async (taskData) => {
  isSavingTask.value = true
  try {
    await updateTask(taskToEdit.value.id, taskData)
    notifySuccess('Tarea actualizada', taskData.titulo)
    isModalOpen.value = false
  } catch (err) {
    notifyError('No se pudo guardar la tarea', err.message)
  } finally {
    isSavingTask.value = false
  }
}

// Configuración básica del calendario
const calendarOptions = ref({
  plugins: [ dayGridPlugin, timeGridPlugin, interactionPlugin ],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  editable: true, // Permite mover y redimensionar
  height: '100%',
  
  // Mapeamos nuestras tareas al formato de eventos de FullCalendar
  events: computed(() => {
    return tasks.value.map(task => {
      // Color según el cuadrante de la matriz
      const bgColor = colorForTask(task)

      // Si falta una de las dos fechas, la otra hace de inicio y fin
      const startDate = task.fecha_inicio || task.fecha_vencimiento
      const endDate = task.fecha_vencimiento || task.fecha_inicio
      if (!startDate) return null

      const startStr = task.con_hora && task.hora_inicio
        ? `${startDate}T${task.hora_inicio}:00`
        : startDate

      // En eventos de día completo FullCalendar trata el fin como EXCLUSIVO:
      // para que cubra el día de vencimiento hay que pasar el día siguiente.
      const endStr = task.con_hora && task.hora_vencimiento
        ? `${endDate}T${task.hora_vencimiento}:00`
        : shiftDate(endDate, 1)

      return {
        id: task.id,
        title: task.titulo,
        start: startStr,
        end: endStr,
        allDay: !task.con_hora,
        backgroundColor: bgColor,
        borderColor: bgColor,
        textColor: quadrantColors.value['on-color-text'],
        extendedProps: { ...task } // Guardar toda la data de la tarea
      }
    }).filter(Boolean) // Solo renderizamos eventos que tengan alguna fecha asignada
  }),

  // Mover (arrastrar) y redimensionar guardan exactamente lo mismo
  eventDrop: (info) => persistEventChange(info, 'No se pudo mover la tarea'),
  eventResize: (info) => persistEventChange(info, 'No se pudo cambiar la duración'),

  // Clic en un evento: abre la tarea para editarla
  eventClick: (info) => {
    const task = tasks.value.find(t => t.id === info.event.id)
    if (!task) return
    taskToEdit.value = { ...task }
    isModalOpen.value = true
  }
})
</script>

<template>
  <div class="calendar-view glass-panel">
    <FullCalendar :options="calendarOptions" />

    <TaskFormModal
      :is-open="isModalOpen"
      :task="taskToEdit"
      :projects="projects"
      :contacts="contacts"
      :saving="isSavingTask"
      @close="isModalOpen = false"
      @save="saveTask"
    />
  </div>
</template>

<style scoped>
.calendar-view {
  height: calc(100vh - 120px);
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
}

/* FullCalendar se adapta a ambos temas mapeando sus variables a las nuestras */
:deep(.fc) {
  --fc-border-color: var(--border-color);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: var(--hover-wash);
  --fc-neutral-text-color: var(--text-secondary);
  --fc-today-bg-color: var(--accent-soft-bg);
  --fc-button-text-color: var(--text-inverse);
  --fc-button-bg-color: var(--accent-primary);
  --fc-button-border-color: var(--accent-primary);
  --fc-button-hover-bg-color: var(--accent-primary-hover);
  --fc-button-hover-border-color: var(--accent-primary-hover);
  --fc-button-active-bg-color: var(--accent-primary-hover);
  --fc-button-active-border-color: var(--accent-primary-hover);
  --fc-event-text-color: var(--on-color-text);
  --fc-now-indicator-color: var(--q1-color);
  --fc-highlight-color: var(--accent-soft-bg);
  color: var(--text-primary);
}

/* Números de día, horas de la columna lateral y textos "más eventos" */
:deep(.fc .fc-daygrid-day-top),
:deep(.fc .fc-timegrid-slot-label-cushion),
:deep(.fc .fc-timegrid-axis-cushion),
:deep(.fc .fc-list-day-text),
:deep(.fc .fc-daygrid-more-link) {
  color: var(--text-secondary);
}

/* Días de otros meses: atenuados en ambos temas */
:deep(.fc .fc-day-other .fc-daygrid-day-top) {
  opacity: 0.45;
}

:deep(.fc .fc-day-today) {
  background: var(--accent-soft-bg) !important;
}

:deep(.fc-theme-standard td), 
:deep(.fc-theme-standard th) {
  border-color: var(--border-color);
}

:deep(.fc .fc-toolbar-title) {
  color: var(--text-primary);
  font-weight: 600;
}

:deep(.fc .fc-button-primary) {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
  text-transform: capitalize;
}

:deep(.fc .fc-button-primary:not(:disabled):active),
:deep(.fc .fc-button-primary:not(:disabled):hover) {
  background-color: var(--accent-primary-hover);
  border-color: var(--accent-primary-hover);
}

:deep(.fc-daygrid-day-number) {
  color: var(--text-secondary);
  padding: 8px;
}

:deep(.fc-col-header-cell-cushion) {
  color: var(--text-primary);
  padding: 8px;
}

:deep(.fc-event) {
  cursor: grab;
}

:deep(.fc-event:active) {
  cursor: grabbing;
}

/* Responsive */
@media (max-width: 768px) {
  .calendar-view {
    padding: 0.75rem;
    height: calc(100vh - 210px);
    min-height: 460px;
  }

  /* La barra de herramientas se apila en filas centradas en lugar de desbordarse */
  :deep(.fc .fc-toolbar.fc-header-toolbar) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  :deep(.fc .fc-toolbar-chunk) {
    display: flex;
    justify-content: center;
  }

  :deep(.fc .fc-toolbar-title) {
    font-size: 1.1rem;
    text-align: center;
  }

  :deep(.fc .fc-button) {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
  }

  /* Números y cabeceras de día más compactos */
  :deep(.fc-daygrid-day-number),
  :deep(.fc-col-header-cell-cushion) {
    padding: 4px;
    font-size: 0.8rem;
  }

  :deep(.fc-event) {
    font-size: 0.7rem;
  }
}
</style>
