import { ref } from 'vue'

// Estado global de los filtros (singleton a nivel de módulo): la barra de la
// cabecera los escribe y las vistas Matriz y Gantt los leen.
const filterStatus = ref('Pendiente')
const filterProject = ref('Todos')
const filterContact = ref('Todos')
const filterDateType = ref('esta-semana')
const filterDateRange = ref({ start: '', end: '' })
const filterSingleDate = ref('')

/**
 * Construye un Date local desde "YYYY-MM-DD" y "HH:MM".
 * Evita el desfase de zona horaria de `new Date("2026-08-12T00:00:00")`,
 * que en algunos navegadores se interpreta como UTC.
 */
export const parseDateTime = (dateStr, timeStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  let h = 0, min = 0
  if (timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number)
    h = hh || 0
    min = mm || 0
  }
  return new Date(y, m - 1, d, h, min, 0, 0)
}

/**
 * Límites temporales del filtro de periodo activo.
 * @returns {{start: Date, end: Date} | null} null = sin acotar (mostrar todo)
 */
export const getDateBounds = () => {
  const now = new Date()

  switch (filterDateType.value) {
    case 'hoy': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { start, end }
    }
    case 'esta-semana': {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Lunes como inicio
      const start = new Date(now.getFullYear(), now.getMonth(), diff)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    case 'este-mes': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    case 'dia': {
      // Día concreto elegido por el usuario. Sin fecha aún, no acotamos.
      if (!filterSingleDate.value) return null
      const start = parseDateTime(filterSingleDate.value, '00:00')
      const end = parseDateTime(filterSingleDate.value, '23:59')
      end.setSeconds(59, 999)
      return { start, end }
    }
    case 'rango': {
      // Rango incompleto: no acotamos hasta que estén las dos fechas.
      if (!filterDateRange.value.start || !filterDateRange.value.end) return null
      const start = parseDateTime(filterDateRange.value.start, '00:00')
      const end = parseDateTime(filterDateRange.value.end, '23:59')
      end.setSeconds(59, 999)
      return { start, end }
    }
    default: // 'todos'
      return null
  }
}

/**
 * ¿La tarea pasa todos los filtros activos?
 * Fuente única de verdad: antes esta lógica estaba duplicada (y ligeramente
 * divergente) en DashboardView y GanttView.
 */
export const matchesFilters = (task) => {
  if (filterStatus.value !== 'Todos' && task.estado !== filterStatus.value) return false
  if (filterProject.value !== 'Todos' && task.proyecto_id !== filterProject.value) return false
  if (filterContact.value !== 'Todos' && task.contacto_id !== filterContact.value) return false

  const bounds = getDateBounds()
  if (!bounds) return true

  // Con periodo acotado, una tarea sin fechas no puede entrar
  if (!task.fecha_inicio && !task.fecha_vencimiento) return false

  const tStart = task.fecha_inicio
    ? parseDateTime(task.fecha_inicio, task.con_hora ? task.hora_inicio : null)
    : null
  const tEnd = task.fecha_vencimiento
    ? parseDateTime(task.fecha_vencimiento, task.con_hora ? task.hora_vencimiento : null)
    : null

  // La tarea entra si empieza dentro, termina dentro, o abarca todo el periodo
  const startsInside = tStart && tStart >= bounds.start && tStart <= bounds.end
  const endsInside = tEnd && tEnd >= bounds.start && tEnd <= bounds.end
  const spansPeriod = tStart && tEnd && tStart <= bounds.start && tEnd >= bounds.end

  return Boolean(startsInside || endsInside || spansPeriod)
}

export function useFilters() {
  return {
    filterStatus,
    filterProject,
    filterContact,
    filterDateType,
    filterDateRange,
    filterSingleDate,
    getDateBounds,
    matchesFilters
  }
}
