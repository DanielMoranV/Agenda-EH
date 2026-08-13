// Servicio para interactuar con la API REST de Google Calendar v3
//
// La autenticación (obtención y renovación del token) la gestiona googleFetch:
// estas funciones ya no reciben el token como parámetro.

import { googleFetch, GoogleApiError } from './google/apiClient'

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const API_NAME = 'Google Calendar'

// Zona horaria del navegador (ej. "America/Lima"). Se la mandamos a Google
// junto a la hora "desnuda" para que no la interprete como UTC.
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const DEFAULT_DURATION_MIN = 60

const pad = (n) => String(n).padStart(2, '0')

/** Suma días a un "YYYY-MM-DD" trabajando siempre en horario local. */
const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** Suma minutos a un par fecha+hora y devuelve el par resultante. */
const addMinutes = (dateStr, timeStr, minutes) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const dt = new Date(y, m - 1, d, hh, mm)
  dt.setMinutes(dt.getMinutes() + minutes)
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  }
}

/** Compara dos pares fecha+hora. Devuelve <0, 0 o >0. */
const compare = (a, b) => (`${a.date}T${a.time}`).localeCompare(`${b.date}T${b.time}`)

/**
 * Evento con hora concreta.
 * Enviamos la hora local "desnuda" (sin Z ni offset) + el campo timeZone: es la
 * forma que recomienda Google y evita el desfase que produce toISOString(),
 * que convierte a UTC y hacía aparecer el evento a otra hora.
 */
const timedSlot = (dateStr, timeStr) => ({
  dateTime: `${dateStr}T${timeStr}:00`,
  timeZone: TIME_ZONE
})

/** Evento de todo el día: Google usa YYYY-MM-DD y fin EXCLUSIVO. */
const allDaySlot = (dateStr) => ({ date: dateStr })

// Arma el cuerpo (payload) que se enviará a Google
const buildEventPayload = (task) => {
  const payload = {
    summary: task.titulo,
    description: task.descripcion || '',
    reminders: {
      useDefault: false,
      overrides: [
        // Notificación popup/push 30 minutos antes (o el mismo día en eventos de día completo)
        { method: 'popup', minutes: 30 },
        // Correo electrónico 1 día (1440 minutos) antes
        { method: 'email', minutes: 1440 }
      ]
    }
  }

  // Si tenemos fecha de inicio, la usamos, sino usamos la de vencimiento como inicio y fin
  const startDate = task.fecha_inicio || task.fecha_vencimiento
  const endDate = task.fecha_vencimiento || task.fecha_inicio
  if (!startDate) return payload

  // ¿La tarea lleva hora? Necesita el flag y al menos una de las dos horas.
  const startTime = task.hora_inicio || task.hora_vencimiento
  const isTimed = Boolean(task.con_hora && startTime)

  if (!isTimed) {
    // --- Evento de todo el día ---
    payload.start = allDaySlot(startDate)
    // El fin es exclusivo: para que el evento cubra el día de vencimiento
    // hay que enviar el día siguiente.
    payload.end = allDaySlot(addDays(endDate, 1))
    return payload
  }

  // --- Evento con rango de horas ---
  const from = { date: startDate, time: startTime }

  let to
  if (task.hora_vencimiento) {
    to = { date: endDate, time: task.hora_vencimiento }
  } else {
    // Sin hora de fin: una hora de duración por defecto
    to = addMinutes(from.date, from.time, DEFAULT_DURATION_MIN)
  }

  // Google rechaza (o normaliza mal) los eventos cuyo fin no es posterior al
  // inicio. Puede pasar si el usuario puso 14:00 - 14:00, o el fin antes.
  if (compare(to, from) <= 0) {
    to = addMinutes(from.date, from.time, DEFAULT_DURATION_MIN)
  }

  payload.start = timedSlot(from.date, from.time)
  payload.end = timedSlot(to.date, to.time)

  return payload
}

// Exportado solo para pruebas del formato del payload
export { buildEventPayload }

export const createCalendarEvent = async (task) => {
  if (!task.fecha_inicio && !task.fecha_vencimiento) return null

  const response = await googleFetch(CALENDAR_API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEventPayload(task))
  }, { apiName: API_NAME })

  const data = await response.json()
  return data.id // Devuelve el eventId de Google
}

export const updateCalendarEvent = async (eventId, task) => {
  if (!eventId) throw new GoogleApiError('Falta el ID del evento para actualizar en Calendar', { apiName: API_NAME })

  // 404/410: el evento fue borrado desde Google. Lo tratamos como "hay que recrearlo"
  // en lugar de como un fallo, para que la tarea no quede desincronizada para siempre.
  const response = await googleFetch(`${CALENDAR_API_BASE}/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEventPayload(task))
  }, { apiName: API_NAME, allowStatuses: [404, 410] })

  if (response.status === 404 || response.status === 410) {
    const newId = await createCalendarEvent(task)
    return { recreated: true, eventId: newId }
  }

  return { recreated: false, eventId }
}

export const deleteCalendarEvent = async (eventId) => {
  if (!eventId) return

  const response = await googleFetch(`${CALENDAR_API_BASE}/${eventId}`, {
    method: 'DELETE'
  }, { apiName: API_NAME, allowStatuses: [404, 410] })

  if (response.status === 404 || response.status === 410) {
    console.warn('El evento ya no existe en Google Calendar. Se omitirá el borrado allí.')
  }
}
