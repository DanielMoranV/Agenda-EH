import { describe, it, expect, vi } from 'vitest'

// El payload es una función pura: no queremos arrastrar Firebase ni el token.
vi.mock('../src/services/google/apiClient', () => ({
  googleFetch: vi.fn(),
  GoogleApiError: class GoogleApiError extends Error {}
}))

const { buildEventPayload } = await import('../src/services/googleCalendar')

const base = { titulo: 'Reunión', descripcion: 'Detalle' }

describe('buildEventPayload', () => {
  it('evento de día completo: el fin es el día SIGUIENTE al vencimiento', () => {
    const payload = buildEventPayload({ ...base, fecha_inicio: '2026-10-05', fecha_vencimiento: '2026-10-08' })
    expect(payload.start).toEqual({ date: '2026-10-05' })
    expect(payload.end).toEqual({ date: '2026-10-09' })
  })

  it('el cambio de mes y de año en el fin exclusivo es correcto', () => {
    expect(buildEventPayload({ ...base, fecha_vencimiento: '2026-10-31' }).end).toEqual({ date: '2026-11-01' })
    expect(buildEventPayload({ ...base, fecha_vencimiento: '2026-12-31' }).end).toEqual({ date: '2027-01-01' })
  })

  it('con solo una fecha, esa fecha hace de inicio y fin', () => {
    const payload = buildEventPayload({ ...base, fecha_vencimiento: '2026-10-08' })
    expect(payload.start).toEqual({ date: '2026-10-08' })
    expect(payload.end).toEqual({ date: '2026-10-09' })
  })

  it('con hora: manda la hora local sin sufijo y con zona horaria', () => {
    const payload = buildEventPayload({
      ...base, fecha_inicio: '2026-10-05', fecha_vencimiento: '2026-10-05',
      con_hora: true, hora_inicio: '10:00', hora_vencimiento: '11:30'
    })
    expect(payload.start.dateTime).toBe('2026-10-05T10:00:00')
    expect(payload.end.dateTime).toBe('2026-10-05T11:30:00')
    expect(payload.start.timeZone).toBeTruthy()
  })

  it('sin hora de fin dura una hora (y cruza la medianoche si hace falta)', () => {
    const payload = buildEventPayload({
      ...base, fecha_inicio: '2026-10-05', fecha_vencimiento: '2026-10-05',
      con_hora: true, hora_inicio: '23:30'
    })
    expect(payload.end.dateTime).toBe('2026-10-06T00:30:00')
  })

  it('un fin igual o anterior al inicio se corrige a una hora', () => {
    const payload = buildEventPayload({
      ...base, fecha_inicio: '2026-10-05', fecha_vencimiento: '2026-10-05',
      con_hora: true, hora_inicio: '14:00', hora_vencimiento: '13:00'
    })
    expect(payload.end.dateTime).toBe('2026-10-05T15:00:00')
  })

  it('marca las tareas finalizadas en el título', () => {
    expect(buildEventPayload({ ...base, estado: 'Finalizado', fecha_vencimiento: '2026-10-05' }).summary).toBe('✅ Reunión')
    expect(buildEventPayload({ ...base, estado: 'Pendiente', fecha_vencimiento: '2026-10-05' }).summary).toBe('Reunión')
  })

  it('sin fechas no genera start ni end', () => {
    const payload = buildEventPayload(base)
    expect(payload.start).toBeUndefined()
    expect(payload.end).toBeUndefined()
  })

  it('incluye los recordatorios', () => {
    const { reminders } = buildEventPayload({ ...base, fecha_vencimiento: '2026-10-05' })
    expect(reminders.useDefault).toBe(false)
    expect(reminders.overrides).toHaveLength(2)
  })
})
