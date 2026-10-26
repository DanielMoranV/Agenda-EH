import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useFilters, parseDateTime } from '../src/composables/useFilters'

// Miércoles 14 de octubre de 2026, 10:00 (hora local)
const NOW = new Date(2026, 9, 14, 10, 0, 0)

const {
  matchesFilters, filterStatus, filterProject, filterContact,
  filterDateType, filterDateRange, filterSingleDate
} = useFilters()

const task = (overrides = {}) => ({
  estado: 'Pendiente',
  proyecto_id: '',
  contacto_id: '',
  fecha_inicio: '2026-10-14',
  fecha_vencimiento: '2026-10-14',
  ...overrides
})

const onDay = (day) => task({ fecha_inicio: day, fecha_vencimiento: day })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  filterStatus.value = 'Todos'
  filterProject.value = 'Todos'
  filterContact.value = 'Todos'
  filterDateType.value = 'esta-semana'
  filterDateRange.value = { start: '', end: '' }
  filterSingleDate.value = ''
})

afterEach(() => vi.useRealTimers())

describe('parseDateTime', () => {
  it('construye la fecha en horario local, sin desfase de día', () => {
    const d = parseDateTime('2026-08-12', '15:30')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 7, 12, 15, 30])
  })
})

describe('filtros por estado, proyecto y responsable', () => {
  it('filtra por estado', () => {
    filterStatus.value = 'Finalizado'
    expect(matchesFilters(task({ estado: 'Finalizado' }))).toBe(true)
    expect(matchesFilters(task({ estado: 'Pendiente' }))).toBe(false)
  })

  it('filtra por proyecto y responsable', () => {
    filterProject.value = 'p1'
    filterContact.value = 'c1'
    expect(matchesFilters(task({ proyecto_id: 'p1', contacto_id: 'c1' }))).toBe(true)
    expect(matchesFilters(task({ proyecto_id: 'p2', contacto_id: 'c1' }))).toBe(false)
    expect(matchesFilters(task({ proyecto_id: 'p1', contacto_id: 'c2' }))).toBe(false)
  })
})

describe('filtro de periodo', () => {
  it('"esta semana" empieza el lunes y termina el domingo', () => {
    expect(matchesFilters(onDay('2026-10-12'))).toBe(true)
    expect(matchesFilters(onDay('2026-10-18'))).toBe(true)
    expect(matchesFilters(onDay('2026-10-11'))).toBe(false)
    expect(matchesFilters(onDay('2026-10-19'))).toBe(false)
  })

  it('"hoy" solo deja pasar las tareas de hoy', () => {
    filterDateType.value = 'hoy'
    expect(matchesFilters(task())).toBe(true)
    expect(matchesFilters(onDay('2026-10-15'))).toBe(false)
  })

  it('una tarea que abarca todo el periodo entra', () => {
    filterDateType.value = 'hoy'
    expect(matchesFilters(task({ fecha_inicio: '2026-10-01', fecha_vencimiento: '2026-10-30' }))).toBe(true)
  })

  it('"día concreto" y "rango" sin fechas elegidas no acotan', () => {
    filterDateType.value = 'dia'
    expect(matchesFilters(onDay('2020-01-01'))).toBe(true)
    filterDateType.value = 'rango'
    expect(matchesFilters(onDay('2020-01-01'))).toBe(true)
  })

  it('"rango" incluye los dos extremos', () => {
    filterDateType.value = 'rango'
    filterDateRange.value = { start: '2026-10-01', end: '2026-10-05' }
    expect(matchesFilters(onDay('2026-10-05'))).toBe(true)
    expect(matchesFilters(onDay('2026-10-06'))).toBe(false)
  })

  it('las tareas sin fechas pasan siempre', () => {
    expect(matchesFilters(task({ fecha_inicio: '', fecha_vencimiento: '' }))).toBe(true)
  })
})

describe('vencidas (solo si se piden)', () => {
  const overdue = task({ fecha_inicio: '2026-10-01', fecha_vencimiento: '2026-10-03' })

  it('no entran por defecto', () => {
    expect(matchesFilters(overdue)).toBe(false)
  })

  it('entran si no están finalizadas', () => {
    expect(matchesFilters(overdue, { includeOverdue: true })).toBe(true)
    expect(matchesFilters({ ...overdue, estado: 'Finalizado' }, { includeOverdue: true })).toBe(false)
  })

  it('las futuras no se cuelan', () => {
    const future = task({ fecha_inicio: '2026-11-01', fecha_vencimiento: '2026-11-02' })
    expect(matchesFilters(future, { includeOverdue: true })).toBe(false)
  })
})
