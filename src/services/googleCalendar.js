// Servicio para interactuar con la API REST de Google Calendar v3

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// Helpers para dar formato a las fechas (Google Calendar requiere formato RFC3339)
const formatDateForGoogle = (dateString, isAllDay = true) => {
  if (!dateString) return null
  
  if (isAllDay) {
    // Evento de todo el día: formato YYYY-MM-DD
    return { date: dateString }
  } else {
    // Evento con hora: formato datetime ISO
    const date = new Date(dateString)
    return { dateTime: date.toISOString() }
  }
}

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

  if (startDate) {
    payload.start = formatDateForGoogle(startDate)
    // Para eventos de todo el día, Google requiere que la fecha de fin sea el día EXCLUSIVO (el día siguiente)
    if (endDate) {
      const endD = new Date(endDate)
      endD.setDate(endD.getDate() + 1)
      payload.end = formatDateForGoogle(endD.toISOString().split('T')[0])
    } else {
      payload.end = payload.start
    }
  }

  return payload
}

export const createCalendarEvent = async (task, token) => {
  if (!token || (!task.fecha_inicio && !task.fecha_vencimiento)) return null

  const payload = buildEventPayload(task)
  
  const response = await fetch(CALENDAR_API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    console.error("Error de Google Calendar:", await response.text())
    throw new Error('Fallo al crear evento en Calendar')
  }

  const data = await response.json()
  return data.id // Devuelve el eventId de Google
}

export const updateCalendarEvent = async (eventId, task, token) => {
  if (!token || !eventId) throw new Error("Falta token o ID de evento para actualizar en Calendar")

  const payload = buildEventPayload(task)
  
  const response = await fetch(`${CALENDAR_API_BASE}/${eventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error("Error actualizando evento de Calendar:", errText)
    throw new Error(`Fallo al actualizar en Google Calendar. ¿Sesión expirada?`)
  }
}

export const deleteCalendarEvent = async (eventId, token) => {
  if (!token || !eventId) throw new Error("Falta token o ID de evento para eliminar en Calendar")
  
  const response = await fetch(`${CALENDAR_API_BASE}/${eventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      console.warn("El evento ya no existe en Google Calendar. Se omitirá el borrado allí.")
      return
    }
    const errText = await response.text()
    console.error("Error eliminando evento de Calendar:", errText)
    throw new Error(`Fallo al eliminar en Google Calendar. ¿Sesión expirada?`)
  }
}
