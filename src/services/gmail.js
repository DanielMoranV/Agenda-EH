import { googleFetch } from './google/apiClient'

const pad = (n) => String(n).padStart(2, '0')

/** Escapa texto del usuario antes de meterlo en el HTML del correo. */
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const localDate = (dateStr, timeStr = '00:00') => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0)
}

// Formato "YYYYMMDD" (eventos de día completo; el fin es exclusivo)
const gcalDay = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`

// Formato "YYYYMMDDTHHMMSSZ" en UTC (eventos con hora)
const gcalInstant = (date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '')

/** Parámetro `dates` de la plantilla de Google Calendar, coherente con el evento real. */
const buildGcalDates = (task) => {
  const startDate = task.fecha_inicio || task.fecha_vencimiento
  const endDate = task.fecha_vencimiento || task.fecha_inicio
  const startTime = task.hora_inicio || task.hora_vencimiento
  const isTimed = Boolean(task.con_hora && startTime)

  if (!isTimed) {
    const end = localDate(endDate)
    end.setDate(end.getDate() + 1)
    return `${gcalDay(localDate(startDate))}/${gcalDay(end)}`
  }

  const start = localDate(startDate, startTime)
  let end = task.hora_vencimiento ? localDate(endDate, task.hora_vencimiento) : null
  if (!end || end <= start) end = new Date(start.getTime() + 60 * 60 * 1000)
  return `${gcalInstant(start)}/${gcalInstant(end)}`
}

// La autenticación (obtención y renovación del token) la gestiona googleFetch.
export async function sendTaskNotificationEmail(taskData, contactData) {
  const subject = `Nueva Tarea Asignada: ${taskData.titulo}`

  // Construir el enlace para añadir a Google Calendar
  let calendarButtonHtml = ''
  if (taskData.fecha_vencimiento || taskData.fecha_inicio) {
    const title = encodeURIComponent(taskData.titulo)
    const details = encodeURIComponent(taskData.descripcion || '')
    const gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${buildGcalDates(taskData)}`

    calendarButtonHtml = `
      <div style="margin-top: 25px;">
         <a href="${escapeHtml(gcalLink)}" target="_blank" style="background-color: #8b5cf6; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">📅 Añadir a Google Calendar</a>
      </div>
    `
  }

  // Construir el cuerpo HTML
  const htmlBody = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #8b5cf6;">Nueva Tarea Asignada</h2>
      <p>Hola <strong>${escapeHtml(contactData.nombre)}</strong>,</p>
      <p>Se te ha asignado la siguiente tarea/reunión:</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin-top:0; color: #0f172a;">${escapeHtml(taskData.titulo)}</h3>
        <p style="color: #475569;">${escapeHtml(taskData.descripcion) || 'Sin descripción adicional.'}</p>
        <p><strong>Estado:</strong> ${escapeHtml(taskData.estado)}</p>
        ${taskData.fecha_vencimiento ? `<p><strong>Vencimiento:</strong> ${escapeHtml(taskData.fecha_vencimiento)}</p>` : ''}
      </div>
      ${calendarButtonHtml}
      <br><br>
      <p style="font-size: 0.8rem; color: #94a3b8;">Mensaje enviado automáticamente desde Agenda EH.</p>
    </div>
  `

  // Construir mensaje RFC 2822
  const boundary = "boundary_agenda_eh_" + new Date().getTime()
  
  // Codificar el Asunto en Base64 UTF-8 para soportar tildes
  const encodedSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
  
  const emailLines = [
    `To: ${contactData.email}`,
    `Subject: ${encodedSubject}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `MIME-Version: 1.0`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    htmlBody,
    `--${boundary}--`
  ]
  const rawEmail = emailLines.join('\r\n')

  // Convertir a Base64 URL (formato requerido por Gmail API)
  const base64EncodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64EncodedEmail })
  }, { apiName: 'Gmail' })

  return await response.json()
}
