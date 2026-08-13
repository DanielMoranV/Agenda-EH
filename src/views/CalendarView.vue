<script setup>
import { computed, ref } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useTasks } from '../composables/useTasks'
import { useNotifications } from '../composables/useNotifications'

const { tasks, updateTask } = useTasks()
const { notifyError } = useNotifications()

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
  droppable: true,
  height: '100%',
  
  // Mapeamos nuestras tareas al formato de eventos de FullCalendar
  events: computed(() => {
    return tasks.value.map(task => {
      // Determinar color base a la matriz (usamos valores por defecto si no existen las variables)
      let bgColor = '#64748b' // Gris oscuro por defecto
      if (task.es_urgente && task.es_importante) bgColor = '#ef4444' // Q1 Rojo
      else if (!task.es_urgente && task.es_importante) bgColor = '#f59e0b' // Q2 Naranja
      else if (task.es_urgente && !task.es_importante) bgColor = '#3b82f6' // Q3 Azul
      else if (!task.es_urgente && !task.es_importante) bgColor = '#10b981' // Q4 Verde

      // Formatear fechas respetando horas opcionales
      const startStr = task.con_hora && task.hora_inicio 
        ? `${task.fecha_inicio}T${task.hora_inicio}:00` 
        : task.fecha_inicio;
        
      const endStr = task.con_hora && task.hora_vencimiento 
        ? `${task.fecha_vencimiento}T${task.hora_vencimiento}:00` 
        : task.fecha_vencimiento;

      return {
        id: task.id,
        title: task.titulo,
        start: startStr || endStr,
        end: endStr || startStr,
        allDay: !task.con_hora,
        backgroundColor: bgColor,
        borderColor: bgColor,
        extendedProps: { ...task } // Guardar toda la data de la tarea
      }
    }).filter(e => e.start) // Solo renderizamos eventos que tengan alguna fecha asignada
  }),

  // Hook que se dispara al arrastrar un evento a otro día
  eventDrop: async (info) => {
    const { event } = info
    const taskId = event.id
    
    // Extraemos las nuevas fechas en formato 'YYYY-MM-DD' de FullCalendar
    const newStart = event.startStr.split('T')[0]
    // FullCalendar da endStr como el día exclusivo para allDay
    const newEnd = event.endStr ? event.endStr.split('T')[0] : newStart

    const updatePayload = {
      fecha_inicio: newStart,
      fecha_vencimiento: newEnd
    }

    // Si se arrastra dentro de una vista TimeGrid, capturamos las horas
    if (event.startStr.includes('T')) {
      updatePayload.con_hora = true
      updatePayload.hora_inicio = event.startStr.split('T')[1].substring(0, 5) // "HH:MM"
      if (event.endStr && event.endStr.includes('T')) {
        updatePayload.hora_vencimiento = event.endStr.split('T')[1].substring(0, 5)
      }
    }

    try {
      // Esto actualizará Firestore y automáticamente tu Google Calendar!
      await updateTask(taskId, updatePayload)
    } catch (e) {
      // Solo revertimos si falló Firestore: los fallos de Google ya no se
      // propagan hasta aquí (se avisan por notificación y se reintentan luego).
      info.revert()
      notifyError('No se pudo mover la tarea', e.message)
    }
  }
})
</script>

<template>
  <div class="calendar-view glass-panel">
    <FullCalendar :options="calendarOptions" />
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

/* Adaptando FullCalendar al Dark Mode de tu app */
:deep(.fc) {
  --fc-border-color: rgba(255, 255, 255, 0.1);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: rgba(255, 255, 255, 0.05);
  --fc-neutral-text-color: var(--text-secondary);
  --fc-today-bg-color: rgba(139, 92, 246, 0.15);
}

:deep(.fc-theme-standard td), 
:deep(.fc-theme-standard th) {
  border-color: rgba(255, 255, 255, 0.1);
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
