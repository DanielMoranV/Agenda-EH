import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/services/google/apiClient', () => ({ googleFetch: vi.fn() }))

const { describeSchedule, buildGcalDates, escapeHtml } = await import('../src/services/gmail')

describe('describeSchedule', () => {
  it('un día con rango de horas', () => {
    const s = describeSchedule({
      fecha_inicio: '2026-10-25', fecha_vencimiento: '2026-10-25',
      con_hora: true, hora_inicio: '10:00', hora_vencimiento: '11:00'
    })
    expect(s.text).toContain('Domingo 25 de octubre de 2026')
    expect(s.text).toContain('10:00 – 11:00')
    expect(s.short).toBe('25 oct, 10:00')
  })

  it('rango de días sin hora', () => {
    const s = describeSchedule({ fecha_inicio: '2026-10-05', fecha_vencimiento: '2026-10-08' })
    expect(s.text).toBe('Del lunes 5 de octubre al jueves 8 de octubre de 2026')
    expect(s.short).toBe('5 oct')
  })

  it('solo vencimiento', () => {
    expect(describeSchedule({ fecha_vencimiento: '2026-10-30' }).text).toBe('Viernes 30 de octubre de 2026')
  })

  it('ignora las horas si con_hora está apagado', () => {
    const s = describeSchedule({ fecha_vencimiento: '2026-10-30', hora_inicio: '09:00' })
    expect(s.text).not.toContain('09:00')
  })

  it('sin fechas devuelve null', () => {
    expect(describeSchedule({})).toBeNull()
  })
})

describe('buildGcalDates', () => {
  it('día completo: fechas YYYYMMDD con fin exclusivo', () => {
    expect(buildGcalDates({ fecha_inicio: '2026-10-05', fecha_vencimiento: '2026-10-08' })).toBe('20261005/20261009')
  })

  it('con hora: instantes UTC con sufijo Z', () => {
    const dates = buildGcalDates({
      fecha_inicio: '2026-10-05', fecha_vencimiento: '2026-10-05',
      con_hora: true, hora_inicio: '10:00', hora_vencimiento: '11:00'
    })
    expect(dates).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
  })
})

describe('escapeHtml', () => {
  it('neutraliza etiquetas y comillas', () => {
    expect(escapeHtml('<b onclick="x">&')).toBe('&lt;b onclick=&quot;x&quot;&gt;&amp;')
  })

  it('tolera null y undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})
